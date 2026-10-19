import { sql } from 'drizzle-orm'
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const accounts = sqliteTable(
  'accounts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    institution: text('institution').notNull(),
    name: text('name').notNull(),
    type: text('type', { enum: ['credit', 'checking'] }).notNull(),
    pluggyItemId: text('pluggy_item_id'),
    /** Id da conta na fonte (ex.: Pluggy), para upsert idempotente. */
    externalId: text('external_id').unique()
  }
)

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  parentId: integer('parent_id'),
  color: text('color').notNull(),
  /** Movimentações que não são consumo (fatura, investimento, entre contas): ficam fora dos gráficos. */
  excludedFromSpending: integer('excluded_from_spending', { mode: 'boolean' }).notNull().default(false),
  /** Gasto essencial (moradia, saúde...): não entra nas sugestões de economia. */
  essential: integer('essential', { mode: 'boolean' }).notNull().default(false)
})

export const imports = sqliteTable('imports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  source: text('source').notNull(),
  fileName: text('file_name'),
  importedAt: text('imported_at').notNull(),
  txCount: integer('tx_count').notNull()
})

export const transactions = sqliteTable(
  'transactions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    accountId: integer('account_id')
      .notNull()
      .references(() => accounts.id),
    source: text('source').notNull(),
    externalId: text('external_id'),
    date: text('date').notNull(),
    descriptionRaw: text('description_raw').notNull(),
    descriptionNorm: text('description_norm').notNull(),
    amountCents: integer('amount_cents').notNull(),
    installmentCurrent: integer('installment_current'),
    installmentTotal: integer('installment_total'),
    statementMonth: text('statement_month'),
    /** Categoria crua informada pela fonte (ex.: "Taxi and ride-hailing" da Pluggy). */
    sourceCategory: text('source_category'),
    categoryId: integer('category_id').references(() => categories.id),
    categorySource: text('category_source', { enum: ['rule', 'source', 'ai', 'manual'] }),
    dedupHash: text('dedup_hash').notNull().unique(),
    importId: integer('import_id').references(() => imports.id)
  },
  (t) => [
    uniqueIndex('transactions_source_external_id').on(t.source, t.externalId),
    index('transactions_date').on(t.date),
    index('transactions_description_norm').on(t.descriptionNorm)
  ]
)

export const rules = sqliteTable('rules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  pattern: text('pattern').notNull(),
  matchType: text('match_type', { enum: ['contains', 'regex', 'exact'] }).notNull(),
  categoryId: integer('category_id')
    .notNull()
    .references(() => categories.id),
  priority: integer('priority').notNull().default(0),
  origin: text('origin', { enum: ['manual', 'correction'] }).notNull()
})

export const statements = sqliteTable(
  'statements',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    accountId: integer('account_id')
      .notNull()
      .references(() => accounts.id),
    refMonth: text('ref_month').notNull(),
    closeDate: text('close_date'),
    dueDate: text('due_date').notNull(),
    totalCents: integer('total_cents').notNull()
  },
  (t) => [uniqueIndex('statements_account_month').on(t.accountId, t.refMonth)]
)

/** Posição atual de cada investimento, como a instituição informa. */
export const investments = sqliteTable('investments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  externalId: text('external_id').notNull().unique(),
  sourceItemId: text('source_item_id'),
  institution: text('institution').notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  subtype: text('subtype'),
  /** Classe KRAKEN escolhida pelo usuário; null = usar a sugerida pelo tipo. */
  krakenClassOverride: text('kraken_class_override', {
    enum: ['cash', 'reits', 'br_stocks', 'crypto', 'intl', 'opportunities']
  }),
  balanceCents: integer('balance_cents').notNull(),
  investedCents: integer('invested_cents'),
  profitCents: integer('profit_cents'),
  // Taxas são percentuais (não dinheiro), então real é aceitável aqui.
  lastTwelveMonthsRate: real('last_twelve_months_rate'),
  lastMonthRate: real('last_month_rate'),
  rate: real('rate'),
  rateType: text('rate_type'),
  fixedAnnualRate: real('fixed_annual_rate'),
  dueDate: text('due_date'),
  status: text('status'),
  updatedAt: text('updated_at'),
  /** Momento do último sync que trouxe este investimento (some quando é resgatado). */
  lastSeenAt: text('last_seen_at').notNull()
})

/** Retrato diário do saldo de cada investimento, para o gráfico de evolução. */
export const investmentSnapshots = sqliteTable(
  'investment_snapshots',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    investmentId: integer('investment_id')
      .notNull()
      .references(() => investments.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    balanceCents: integer('balance_cents').notNull()
  },
  (t) => [uniqueIndex('investment_snapshots_day').on(t.investmentId, t.date)]
)

/** Metas da alocação KRAKEN, em % inteiro por classe. */
export const allocationTargets = sqliteTable('allocation_targets', {
  krakenClass: text('kraken_class').primaryKey(),
  targetPercent: integer('target_percent').notNull()
})

/** Cache da IA: mesma descrição normalizada nunca é enviada duas vezes. */
export const aiCache = sqliteTable('ai_cache', {
  descriptionNorm: text('description_norm').primaryKey(),
  categoryId: integer('category_id').references(() => categories.id),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`)
})

/** Configurações não secretas (segredos ficam cifrados em arquivo, ver secrets.ts). */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull()
})
