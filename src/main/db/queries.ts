import { and, asc, desc, eq, gte, inArray, isNull, like, ne, or, sql, type SQL } from 'drizzle-orm'
import type {
  Account,
  Category,
  CategorySource,
  DashboardData,
  MonthSpending,
  Rule,
  RuleInput,
  Transaction,
  TransactionFilter
} from '@shared/types'
import { addMonths, monthOf, today } from '../pipeline/normalize'
import { projectMonths } from '../pipeline/projection'
import { detectRecurring } from '../pipeline/recurring'
import { findMatchingRule, sortRules } from '../pipeline/rules'
import type { Db } from './client'
import { accounts, aiCache, categories, rules, transactions } from './schema'
import { NON_SPENDING_CATEGORIES } from './seed'

/** Mês de competência: fatura para cartão, mês da data para conta. */
const competenceMonth = sql<string>`coalesce(${transactions.statementMonth}, substr(${transactions.date}, 1, 7))`

// ---------- Leituras simples ----------

export function listAccounts(db: Db): Account[] {
  return db
    .select({ id: accounts.id, institution: accounts.institution, name: accounts.name, type: accounts.type })
    .from(accounts)
    .orderBy(asc(accounts.institution), asc(accounts.name))
    .all()
}

export function listCategories(db: Db): Category[] {
  return db.select().from(categories).orderBy(asc(categories.name)).all()
}

export function listRules(db: Db): Rule[] {
  return sortRules(db.select().from(rules).all())
}

export function listMonths(db: Db): string[] {
  return db
    .selectDistinct({ month: competenceMonth })
    .from(transactions)
    .orderBy(desc(competenceMonth))
    .all()
    .map((row) => row.month)
}

export function listTransactions(db: Db, filter: TransactionFilter): Transaction[] {
  const conditions: SQL[] = []
  if (filter.accountId !== undefined) conditions.push(eq(transactions.accountId, filter.accountId))
  if (filter.categoryId === null) conditions.push(isNull(transactions.categoryId))
  else if (filter.categoryId !== undefined) conditions.push(eq(transactions.categoryId, filter.categoryId))
  if (filter.month) conditions.push(eq(competenceMonth, filter.month))
  if (filter.search?.trim()) {
    const term = `%${filter.search.trim()}%`
    conditions.push(or(like(transactions.descriptionRaw, term), like(transactions.descriptionNorm, term))!)
  }

  return db
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      accountName: accounts.name,
      date: transactions.date,
      descriptionRaw: transactions.descriptionRaw,
      descriptionNorm: transactions.descriptionNorm,
      amountCents: transactions.amountCents,
      installmentCurrent: transactions.installmentCurrent,
      installmentTotal: transactions.installmentTotal,
      statementMonth: transactions.statementMonth,
      categoryId: transactions.categoryId,
      categorySource: transactions.categorySource
    })
    .from(transactions)
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .where(and(...conditions))
    .orderBy(desc(transactions.date), desc(transactions.id))
    .limit(5000)
    .all()
}

// ---------- Categorização manual e regras ----------

/**
 * Recalcula a categoria de toda transação não manual a partir das regras atuais.
 * Quem deixou de casar com regra volta para o cache da IA ou para "Sem categoria".
 */
export function reapplyRules(db: Db): number {
  const sorted = listRules(db)
  const cache = new Map(db.select().from(aiCache).all().map((row) => [row.descriptionNorm, row.categoryId]))
  const candidates = db
    .select({
      id: transactions.id,
      descriptionNorm: transactions.descriptionNorm,
      categoryId: transactions.categoryId,
      categorySource: transactions.categorySource
    })
    .from(transactions)
    .where(or(isNull(transactions.categorySource), ne(transactions.categorySource, 'manual')))
    .all()

  let changed = 0
  db.transaction((tx) => {
    for (const row of candidates) {
      const rule = findMatchingRule(sorted, row.descriptionNorm)
      const cached = cache.get(row.descriptionNorm) ?? null
      const next: { categoryId: number | null; categorySource: CategorySource | null } = rule
        ? { categoryId: rule.categoryId, categorySource: 'rule' }
        : cached !== null
          ? { categoryId: cached, categorySource: 'ai' }
          : { categoryId: null, categorySource: null }
      if (next.categoryId === row.categoryId && next.categorySource === row.categorySource) continue
      tx.update(transactions).set(next).where(eq(transactions.id, row.id)).run()
      changed++
    }
  })
  return changed
}

/**
 * Correção manual: grava a categoria e cria (ou atualiza) uma regra `correction`
 * com a descrição exata, para o app aprender. Depois reaplica as regras.
 */
export function updateTransactionCategory(db: Db, transactionId: number, categoryId: number | null): number {
  const target = db.select().from(transactions).where(eq(transactions.id, transactionId)).get()
  if (!target) throw new Error('Transação não encontrada')

  db.transaction((tx) => {
    tx.update(transactions)
      .set({ categoryId, categorySource: categoryId === null ? null : 'manual' })
      .where(eq(transactions.id, transactionId))
      .run()

    const existing = tx
      .select()
      .from(rules)
      .where(
        and(eq(rules.origin, 'correction'), eq(rules.matchType, 'exact'), eq(rules.pattern, target.descriptionNorm))
      )
      .get()

    if (categoryId === null) {
      if (existing) tx.delete(rules).where(eq(rules.id, existing.id)).run()
    } else if (existing) {
      tx.update(rules).set({ categoryId }).where(eq(rules.id, existing.id)).run()
    } else {
      tx.insert(rules)
        .values({ pattern: target.descriptionNorm, matchType: 'exact', categoryId, priority: 100, origin: 'correction' })
        .run()
    }
  })

  return reapplyRules(db) + 1
}

export function saveRule(db: Db, input: RuleInput): Rule {
  const values = {
    pattern: input.pattern,
    matchType: input.matchType,
    categoryId: input.categoryId,
    priority: input.priority
  }
  const saved =
    input.id !== undefined
      ? db.update(rules).set(values).where(eq(rules.id, input.id)).returning().get()
      : db.insert(rules).values({ ...values, origin: 'manual' }).returning().get()
  if (!saved) throw new Error('Regra não encontrada')
  reapplyRules(db)
  return saved
}

export function deleteRule(db: Db, id: number): void {
  db.delete(rules).where(eq(rules.id, id)).run()
  reapplyRules(db)
}

// ---------- Dashboard ----------

export function getDashboard(db: Db, monthCount: number): DashboardData {
  const currentMonth = monthOf(today())
  const firstMonth = addMonths(currentMonth, -(monthCount - 1))
  const excludedIds = db
    .select({ id: categories.id })
    .from(categories)
    .where(inArray(categories.name, NON_SPENDING_CATEGORIES))
    .all()
    .map((c) => c.id)
  const isSpending = (categoryId: number | null) => categoryId === null || !excludedIds.includes(categoryId)

  // Janela larga: meses exibidos + 12 meses de histórico para recorrência e parcelas.
  const yearAgo = addMonths(currentMonth, -12)
  const historyStart = firstMonth < yearAgo ? firstMonth : yearAgo
  const rows = db
    .select({
      accountId: transactions.accountId,
      date: transactions.date,
      descriptionNorm: transactions.descriptionNorm,
      amountCents: transactions.amountCents,
      installmentCurrent: transactions.installmentCurrent,
      installmentTotal: transactions.installmentTotal,
      categoryId: transactions.categoryId,
      month: competenceMonth
    })
    .from(transactions)
    .where(gte(competenceMonth, historyStart))
    .all()
    .filter((row) => isSpending(row.categoryId))

  const months: MonthSpending[] = []
  for (let month = firstMonth; month <= currentMonth; month = addMonths(month, 1)) {
    months.push({ month, byCategory: {}, expenseCents: 0, incomeCents: 0 })
  }
  const byMonth = new Map(months.map((m) => [m.month, m]))
  for (const row of rows) {
    const entry = byMonth.get(row.month)
    if (!entry) continue
    if (row.amountCents < 0) {
      const key = row.categoryId === null ? 'none' : String(row.categoryId)
      entry.byCategory[key] = (entry.byCategory[key] ?? 0) - row.amountCents
      entry.expenseCents -= row.amountCents
    } else {
      entry.incomeCents += row.amountCents
    }
  }

  const subscriptions = detectRecurring(rows.filter((row) => row.date >= `${yearAgo}-01`))
  const projection = projectMonths(rows, subscriptions, currentMonth, 4)

  return { months, projection, subscriptions }
}
