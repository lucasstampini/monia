import type { AccountType } from '@shared/types'
import { createLogger } from '../../logger'
import {
  addMonths,
  billMonthFor,
  inferCloseDay,
  monthOf,
  statementMonthFor,
  today,
  toCents,
  toLocalDate
} from '../../pipeline/normalize'
import type { RawAccount, RawInvestment, RawStatement, RawTransaction, SourceAdapter, SourceBatch } from '../types'
import { parseEach, PluggyClient, type PluggyCredentials } from './client'
import {
  accountSchema,
  billSchema,
  investmentSchema,
  transactionSchema,
  type PluggyAccount,
  type PluggyBill,
  type PluggyInvestment,
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

/** Sem o dia de fechamento, o mês da fatura cai no mês do vencimento. */
export function mapBill(bill: PluggyBill, accountExternalId: string, closeDay: number | null): RawStatement {
  const dueDate = toLocalDate(bill.dueDate)
  return {
    accountExternalId,
    refMonth: closeDay === null ? monthOf(dueDate) : billMonthFor(dueDate, closeDay),
    closeDate: null,
    dueDate,
    // Fatura é dinheiro saindo: negativo, como os gastos.
    totalCents: -Math.abs(toCents(bill.totalAmount))
  }
}

/**
 * Dia de fechamento do cartão. Primeiro deduz das faturas já fechadas (dado real);
 * se não houver, usa a data de fechamento informada na conta, quando a instituição manda.
 */
export function closeDayFor(account: PluggyAccount, transactions: PluggyTransaction[]): number | null {
  const inferred = inferCloseDay(
    transactions.map((tx) => ({ date: toLocalDate(tx.date), billId: tx.creditCardMetadata?.billId ?? null }))
  )
  if (inferred !== null) return inferred
  const close = account.creditData?.balanceCloseDate
  return close ? Number(toLocalDate(close).slice(8, 10)) : null
}

/** Como achar o mês da fatura de uma compra no cartão. */
export interface BillingCycle {
  /** Mês de cada fatura fechada, pelo id da fatura na Pluggy. */
  billMonthById: Map<string, string>
  closeDay: number | null
}

export function mapTransaction(tx: PluggyTransaction, account: PluggyAccount, cycle: BillingCycle): RawTransaction {
  const date = toLocalDate(tx.date)
  // Moeda estrangeira: `amount` vem na moeda original; queremos o valor em reais.
  const value = tx.amountInAccountCurrency ?? tx.amount
  // O sinal vem do `type`, não do número, para funcionar igual em conta e cartão.
  const amountCents = tx.type === 'DEBIT' ? -Math.abs(toCents(value)) : Math.abs(toCents(value))

  // Fatura fechada: vale a da Pluggy. Fatura aberta e parcelas futuras ainda não têm fatura:
  // calculamos pelo dia de fechamento.
  let statementMonth: string | null = null
  if (mapAccountType(account) === 'credit') {
    const billId = tx.creditCardMetadata?.billId
    if (billId && cycle.billMonthById.has(billId)) statementMonth = cycle.billMonthById.get(billId)!
    else if (cycle.closeDay !== null) statementMonth = statementMonthFor(date, cycle.closeDay)
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

export function mapInvestment(investment: PluggyInvestment, institution: string, itemId: string): RawInvestment {
  const balanceCents = toCents(investment.balance)
  const investedCents = investment.amountOriginal != null ? toCents(investment.amountOriginal) : null
  // Sem lucro informado, deduzimos de saldo - valor aplicado quando os dois existem.
  const profitCents =
    investment.amountProfit != null
      ? toCents(investment.amountProfit)
      : investedCents !== null
        ? balanceCents - investedCents
        : null
  return {
    externalId: investment.id,
    sourceItemId: itemId,
    institution,
    name: investment.name,
    type: investment.type,
    subtype: investment.subtype ?? null,
    balanceCents,
    investedCents,
    profitCents,
    lastTwelveMonthsRate: investment.lastTwelveMonthsRate ?? null,
    lastMonthRate: investment.lastMonthRate ?? null,
    rate: investment.rate ?? null,
    rateType: investment.rateType ?? null,
    fixedAnnualRate: investment.fixedAnnualRate ?? null,
    dueDate: investment.dueDate ? toLocalDate(investment.dueDate) : null,
    status: investment.status ?? null,
    updatedAt: investment.date ? toLocalDate(investment.date) : null
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
    const batch: SourceBatch = {
      source: this.source,
      accounts: [],
      transactions: [],
      statements: [],
      investments: [],
      errors: []
    }
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

          const isCredit = mapAccountType(account) === 'credit'
          let bills: PluggyBill[] = []
          if (isCredit) {
            onProgress(`Lendo faturas de ${account.name}…`)
            try {
              bills = parseEach(billSchema, await this.client.getAll('/bills', { accountId: account.id }), 'Fatura', batch.errors)
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
          const transactions = parseEach(transactionSchema, rawTransactions, 'Transação', batch.errors)

          // O fechamento sai das próprias faturas, então as transações vêm antes de mapear as faturas.
          const cycle: BillingCycle = {
            billMonthById: new Map(),
            closeDay: isCredit ? closeDayFor(account, transactions) : null
          }
          for (const bill of bills) {
            const statement = mapBill(bill, account.id, cycle.closeDay)
            batch.statements.push(statement)
            cycle.billMonthById.set(bill.id, statement.refMonth)
          }

          const before = batch.transactions.length
          for (const tx of transactions) {
            try {
              batch.transactions.push(mapTransaction(tx, account, cycle))
            } catch (error) {
              batch.errors.push(`Transação ${tx.id}: ${errorMessage(error)}`)
            }
          }
          log.info('conta lida', {
            account: account.name,
            type: account.type,
            received: rawTransactions.length,
            mapped: batch.transactions.length - before,
            bills: bills.length,
            closeDay: cycle.closeDay,
            from
          })
        }

        // Investimentos: falha aqui não impede contas e transações.
        onProgress(`Lendo investimentos de ${item.connector.name}…`)
        try {
          const raw = await this.client.getAll('/investments', { itemId })
          const parsed = parseEach(investmentSchema, raw, 'Investimento', batch.errors)
          // Resgatados totalmente não fazem parte da carteira atual.
          const active = parsed.filter((i) => i.status !== 'TOTAL_WITHDRAWAL')
          batch.investments.push(...active.map((i) => mapInvestment(i, item.connector.name, itemId)))
          log.info('investimentos lidos', { itemId, received: raw.length, active: active.length })
        } catch (error) {
          log.error('investimentos falharam', { itemId, error: errorMessage(error) })
          batch.errors.push(`Investimentos de ${item.connector.name}: ${errorMessage(error)}`)
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
