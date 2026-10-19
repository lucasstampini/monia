import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema'
import { reapplyRules } from './queries'
import { seed } from './seed'

export type Db = BetterSQLite3Database<typeof schema>

/** Abre o SQLite, aplica migrations pendentes e popula dados iniciais. */
export function openDatabase(filePath: string, migrationsFolder: string): Db {
  const sqlite = new Database(filePath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder })
  // Regras padrão novas valem também para o histórico já importado.
  if (seed(db)) reapplyRules(db)
  return db
}
