import type { AccountType } from '@shared/types'
import { createLogger } from '../../logger'
import { addMonths, monthOf, statementMonthFor, today, toCents, toLocalDate } from '../../pipeline/normalize'
import type { RawAccount, RawStatement, RawTransaction, SourceAdapter, SourceBatch } from '../types'
import { parseEach, PluggyClient, type PluggyCredentials } from './client'
import {
  accountSchema,
  billSchema,
  transactionSchema,
  type PluggyAccount,
  type PluggyBill,
  type PluggyTransaction
} from './schemas'

const log = createLogger('pluggy')

// ---------- Conversões puras (testadas com fixtures) ----------

export function mapAccountType(account: PluggyAccount): AccountType {
  return account.type === 'CREDIT' ? 'credit' : 'checking'
}

export function mapAccount(account: PluggyAccount, institution: string, itemId: string): RawAccount {
  return {
    externalId: account.id,
    institution,
    name: account.marketingName ?? account.name,
    type: mapAccountType(account),
    sourceItemId: itemId
  }
}

export function mapBill(bill: PluggyBill, accountExternalId: string): RawStatement {
  const dueDate = toLocalDate(bill.dueDate)
  return {
    accountExternalId,
    refMonth: monthOf(dueDate),
    closeDate: null,
    dueDate,
    // Fatura é dinheiro saindo: negativo, como os gastos.
    totalCents: -Math.abs(toCents(bill.totalAmount))
  }
}

/** Dias de fechamento e vencimento a partir dos dados de crédito da conta, se houver. */
export function billingDays(account: PluggyAccount): { closeDay: number; dueDay: number } | null {
  const close = account.creditData?.balanceCloseDate
  const due = account.creditData?.balanceDueDate
  if (!close || !due) return null
  return { closeDay: Number(toLocalDate(close).slice(8, 10)), dueDay: Number(toLocalDate(due).slice(8, 10)) }
}

export function mapTransaction(
  tx: PluggyTransaction,
  account: PluggyAccount,
  billMonthById: Map<string, string>
): RawTransaction {
  const date = toLocalDate(tx.date)
  // Moeda estrangeira: `amount` vem na moeda original; queremos o valor em reais.
  const value = tx.amountInAccountCurrency ?? tx.amount
  // O sinal vem do `type`, não do número, para funcionar igual em conta e cartão.
  const amountCents = tx.type === 'DEBIT' ? -Math.abs(toCents(value)) : Math.abs(toCents(value))

  let statementMonth: string | null = null
  if (mapAccountType(account) === 'credit') {
    const billId = tx.creditCardMetadata?.billId
    const days = billingDays(account)
    if (billId && billMonthById.has(billId)) statementMonth = billMonthById.get(billId)!
    else if (days) statementMonth = statementMonthFor(date, days.closeDay, days.dueDay)
  }

  return {
    externalId: tx.id,
    accountExternalId: account.id,
    date,
    description: tx.description || tx.descriptionRaw || '(sem descrição)',
    amountCents,
    installmentCurrent: tx.creditCardMetadata?.installmentNumber ?? null,
    installmentTotal: tx.creditCardMetadata?.totalInstallments ?? null,
    statementMonth,
    sourceCategory: tx.category ?? null
  }
}

// ---------- Adaptador (faz as chamadas de rede) ----------

export interface PluggyAdapterOptions {
  credentials: PluggyCredentials
  itemIds: string[]
  /** Data inicial (YYYY-MM-DD). Padrão: 12 meses atrás. */
  from?: string
}

export class PluggyAdapter implements SourceAdapter {
  readonly source = 'pluggy'
  private readonly client: PluggyClient

  constructor(private readonly options: PluggyAdapterOptions) {
    this.client = new PluggyClient(options.credentials)
  }

  async fetch(onProgress: (step: string) => void = () => {}): Promise<SourceBatch> {
    const batch: SourceBatch = { source: this.source, accounts: [], transactions: [], statements: [], errors: [] }
    const from = this.options.from ?? `${addMonths(monthOf(today()), -12)}-01`

    for (const itemId of this.options.itemIds) {
      try {
        onProgress('Conectando à instituição…')
        const item = await this.client.getItem(itemId)
        onProgress(`Lendo contas de ${item.connector.name}…`)
        const rawAccounts = await this.client.getAll('/accounts', { itemId })
        const accounts = parseEach(accountSchema, rawAccounts, 'Conta', batch.errors)

        for (const account of accounts) {
          batch.accounts.push(mapAccount(account, item.connector.name, itemId))

          const billMonthById = new Map<string, string>()
          if (mapAccountType(account) === 'credit') {
            onProgress(`Lendo faturas de ${account.name}…`)
            try {
              const bills = parseEach(billSchema, await this.client.getAll('/bills', { accountId: account.id }), 'Fatura', batch.errors)
              for (const bill of bills) {
                const statement = mapBill(bill, account.id)
                batch.statements.push(statement)
                billMonthById.set(bill.id, statement.refMonth)
              }
            } catch (error) {
              batch.errors.push(`Faturas de ${account.name}: ${errorMessage(error)}`)
            }
          }

          onProgress(`Lendo transações de ${account.name}…`)
          let rawTransactions: unknown[]
          try {
            // `/v2/transactions` (cursor): o `/transactions` paginado devolve 410 em contas novas da Pluggy.
            rawTransactions = await this.client.getAllByCursor('/v2/transactions', {
              accountId: account.id,
              dateFrom: from
            })
          } catch (error) {
            // Uma conta com problema não impede a leitura das outras.
            log.error('transações da conta falharam', { account: account.name, error: errorMessage(error) })
            batch.errors.push(`Transações de ${account.name}: ${errorMessage(error)}`)
            continue
          }
          const before = batch.transactions.length
          for (const tx of parseEach(transactionSchema, rawTransactions, 'Transação', batch.errors)) {
            try {
              batch.transactions.push(mapTransaction(tx, account, billMonthById))
            } catch (error) {
              batch.errors.push(`Transação ${tx.id}: ${errorMessage(error)}`)
            }
          }
          log.info('conta lida', {
            account: account.name,
            type: account.type,
            received: rawTransactions.length,
            mapped: batch.transactions.length - before,
            bills: billMonthById.size,
            from
          })
        }
      } catch (error) {
        log.error('conexão falhou', { itemId, error: errorMessage(error) })
        batch.errors.push(`Conexão ${itemId}: ${errorMessage(error)}`)
      }
    }
    return batch
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
