import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

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
  color: text('color').notNull()
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
