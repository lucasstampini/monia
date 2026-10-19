import { and, eq, inArray, isNull } from 'drizzle-orm'
import type { SyncResult } from '@shared/types'
import type { LLMProvider } from '../ai/provider'
import type { Db } from '../db/client'
import { listCategories, listRules } from '../db/queries'
import { accounts, aiCache, imports, statements, transactions } from '../db/schema'
import type { SourceAdapter, SourceBatch } from '../ingestion/types'
import { categorize } from './categorize'
import { dedupHashes } from './dedup'
import { resolveInstallment } from './installments'
import { createLogger, timed } from '../logger'
import { normalizeDescription } from './normalize'

const log = createLogger('sync')

/**
 * Orquestra o fluxo completo:
 * fonte -> normalize -> dedup -> installments -> persiste -> categorize.
 * Idempotente: rodar duas vezes com os mesmos dados não duplica nada.
 */
export async function runImport(
  db: Db,
  adapter: SourceAdapter,
  provider: LLMProvider | null,
  onProgress: (step: string) => void = () => {}
): Promise<SyncResult> {
  log.info('início', { source: adapter.source, ai: provider?.name ?? 'nenhuma' })
  const batch = await timed(log, 'buscar na fonte', () => adapter.fetch(onProgress), (b) => ({
    accounts: b.accounts.length,
    transactions: b.transactions.length,
    statements: b.statements.length,
    errors: b.errors.length
  }))
  const errors = [...batch.errors]

  onProgress('Salvando contas e faturas…')
  const accountIdByExternal = await timed(log, 'salvar contas e faturas', () => saveAccountsAndStatements(db, batch))

  onProgress('Salvando transações…')
  const { inserted, updated } = await timed(
    log,
    'salvar transações',
    () => saveTransactions(db, batch, accountIdByExternal, errors),
    (r) => r
  )

  onProgress(provider ? `Categorizando com regras e ${provider.name}…` : 'Categorizando com regras…')
  const categorized = await timed(
    log,
    'categorizar',
    () =>
      categorizePending(db, provider, (current, total) =>
        onProgress(`Categorizando com ${provider?.name ?? 'IA'}: lote ${current} de ${total}…`)
      ),
    (r) => ({ byRule: r.byRule, byAi: r.byAi, errors: r.errors.length })
  )
  errors.push(...categorized.errors)
  for (const error of errors) log.warn('aviso do import', { error })

  return {
    accounts: batch.accounts.length,
    received: batch.transactions.length,
    inserted,
    updated,
    errors,
    categorizedByRule: categorized.byRule,
    categorizedByAi: categorized.byAi
  }
}

function saveAccountsAndStatements(db: Db, batch: SourceBatch): Map<string, number> {
  const accountIdByExternal = new Map<string, number>()
  db.transaction((tx) => {
    for (const account of batch.accounts) {
      const saved = tx
        .insert(accounts)
        .values({
          externalId: account.externalId,
          institution: account.institution,
          name: account.name,
          type: account.type,
          pluggyItemId: account.sourceItemId
        })
        .onConflictDoUpdate({
          target: accounts.externalId,
          set: { institution: account.institution, name: account.name, type: account.type }
        })
        .returning({ id: accounts.id })
        .get()
      accountIdByExternal.set(account.externalId, saved.id)
    }

    for (const statement of batch.statements) {
      const accountId = accountIdByExternal.get(statement.accountExternalId)
      if (accountId === undefined) continue
      const values = {
        accountId,
        refMonth: statement.refMonth,
        closeDate: statement.closeDate,
        dueDate: statement.dueDate,
        totalCents: statement.totalCents
      }
      tx.insert(statements)
        .values(values)
        .onConflictDoUpdate({ target: [statements.accountId, statements.refMonth], set: values })
        .run()
    }
  })
  return accountIdByExternal
}

function saveTransactions(
  db: Db,
  batch: SourceBatch,
  accountIdByExternal: Map<string, number>,
  errors: string[]
): { inserted: number; updated: number } {
  const normalized = batch.transactions.map((raw) => ({
    ...raw,
    descriptionNorm: normalizeDescription(raw.description),
    installment: resolveInstallment(raw.description, { current: raw.installmentCurrent, total: raw.installmentTotal })
  }))
  const hashes = dedupHashes(normalized)

  let inserted = 0
  let updated = 0
  db.transaction((tx) => {
    const importRow = tx
      .insert(imports)
      .values({ source: batch.source, fileName: null, importedAt: new Date().toISOString(), txCount: 0 })
      .returning({ id: imports.id })
      .get()

    normalized.forEach((item, index) => {
      const accountId = accountIdByExternal.get(item.accountExternalId)
      if (accountId === undefined) {
        errors.push(`Transação ${item.externalId ?? item.description}: conta desconhecida`)
        return
      }
      // Campos que a fonte pode corrigir depois (ex.: lançamento pendente que foi confirmado).
      const sourceFields = {
        date: item.date,
        descriptionRaw: item.description,
        descriptionNorm: item.descriptionNorm,
        amountCents: item.amountCents,
        installmentCurrent: item.installment?.current ?? null,
        installmentTotal: item.installment?.total ?? null,
        statementMonth: item.statementMonth,
        sourceCategory: item.sourceCategory
      }
      try {
        // Já existe (mesmo id externo)? Atualiza os dados da fonte e preserva a categoria.
        if (item.externalId !== null) {
          const result = tx
            .update(transactions)
            .set(sourceFields)
            .where(and(eq(transactions.source, batch.source), eq(transactions.externalId, item.externalId)))
            .run()
          if (result.changes > 0) {
            updated += result.changes
            return
          }
        }
        const result = tx
          .insert(transactions)
          .values({
            ...sourceFields,
            accountId,
            source: batch.source,
            externalId: item.externalId,
            dedupHash: hashes[index]!,
            importId: importRow.id
          })
          // Mesmo hash = mesma transação vinda por outro caminho: ignora.
          .onConflictDoNothing()
          .run()
        inserted += result.changes
      } catch (error) {
        // Uma linha ruim não derruba o import.
        errors.push(`Transação ${item.externalId ?? item.description}: ${(error as Error).message}`)
      }
    })

    tx.update(imports).set({ txCount: inserted }).where(eq(imports.id, importRow.id)).run()
  })
  return { inserted, updated }
}

/**
 * Categoriza tudo que ainda está sem categoria (novas e antigas).
 * Assim, configurar a IA depois do primeiro sync também beneficia o histórico.
 */
export async function categorizePending(
  db: Db,
  provider: LLMProvider | null,
  onBatch?: (batch: number, totalBatches: number) => void
): Promise<{ byRule: number; byAi: number; errors: string[] }> {
  const pending = db
    .select({
      id: transactions.id,
      descriptionNorm: transactions.descriptionNorm,
      amountCents: transactions.amountCents,
      date: transactions.date,
      sourceCategory: transactions.sourceCategory
    })
    .from(transactions)
    .where(isNull(transactions.categoryId))
    .all()
  if (pending.length === 0) return { byRule: 0, byAi: 0, errors: [] }

  log.info('sem categoria antes', {
    transactions: pending.length,
    uniqueDescriptions: new Set(pending.map((p) => p.descriptionNorm)).size
  })
  const output = await categorize(pending, {
    rules: listRules(db),
    categories: listCategories(db),
    aiCache: new Map(db.select().from(aiCache).all().map((row) => [row.descriptionNorm, row.categoryId])),
    provider,
    onBatch
  })

  db.transaction((tx) => {
    output.results.forEach((result, index) => {
      if (result.categoryId === null) return
      tx.update(transactions)
        .set({ categoryId: result.categoryId, categorySource: result.source })
        .where(eq(transactions.id, pending[index]!.id))
        .run()
    })
    for (const [descriptionNorm, categoryId] of output.newCacheEntries) {
      tx.insert(aiCache)
        .values({ descriptionNorm, categoryId })
        .onConflictDoUpdate({ target: aiCache.descriptionNorm, set: { categoryId } })
        .run()
    }
  })

  return {
    byRule: output.results.filter((r) => r.source === 'rule' || r.source === 'source').length,
    byAi: output.results.filter((r) => r.source === 'ai').length,
    errors: output.errors
  }
}
