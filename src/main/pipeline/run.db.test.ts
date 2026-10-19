// Teste de integração com SQLite real (em memória).
// Roda com `npm run test:db`: o better-sqlite3 é compilado para o Node do Electron.
import { describe, expect, it } from 'vitest'
import { count, eq } from 'drizzle-orm'
import type { LLMProvider } from '../ai/provider'
import { openDatabase } from '../db/client'
import { listRules, updateTransactionCategory } from '../db/queries'
import { categories, rules, transactions } from '../db/schema'
import type { SourceAdapter, SourceBatch } from '../ingestion/types'
import { runImport } from './run'

function fakeAdapter(batch: Omit<SourceBatch, 'source' | 'errors'>): SourceAdapter {
  return { source: 'fake', fetch: async () => ({ source: 'fake', errors: [], ...structuredClone(batch) }) }
}

const batch = {
  accounts: [{ externalId: 'card', institution: 'Banco', name: 'Cartão', type: 'credit' as const, sourceItemId: null }],
  statements: [],
  transactions: [
    { externalId: 't1', accountExternalId: 'card', date: '2024-05-01', description: 'IFOOD *LANCHE', amountCents: -3000, installmentCurrent: null, installmentTotal: null, statementMonth: '2024-06' },
    { externalId: 't2', accountExternalId: 'card', date: '2024-05-02', description: 'LOJA X PARC 02/05', amountCents: -10000, installmentCurrent: null, installmentTotal: null, statementMonth: '2024-06' },
    { externalId: 't3', accountExternalId: 'card', date: '2024-05-03', description: 'PADARIA', amountCents: -800, installmentCurrent: null, installmentTotal: null, statementMonth: '2024-06' },
    { externalId: 't4', accountExternalId: 'card', date: '2024-05-04', description: 'PADARIA', amountCents: -800, installmentCurrent: null, installmentTotal: null, statementMonth: '2024-06' }
  ]
}

const db = () => openDatabase(':memory:', 'drizzle')
const total = (database: ReturnType<typeof db>) => database.select({ n: count() }).from(transactions).get()!.n

describe('runImport', () => {
  it('é idempotente: importar duas vezes não duplica', async () => {
    const database = db()
    const first = await runImport(database, fakeAdapter(batch), null)
    const second = await runImport(database, fakeAdapter(batch), null)
    expect(first.inserted).toBe(4)
    expect(second.inserted).toBe(0)
    expect(second.updated).toBe(4)
    expect(total(database)).toBe(4)
  })

  it('normaliza, detecta parcela e aplica regras padrão', async () => {
    const database = db()
    await runImport(database, fakeAdapter(batch), null)
    const loja = database.select().from(transactions).where(eq(transactions.externalId, 't2')).get()!
    expect(loja).toMatchObject({ descriptionNorm: 'LOJA X', installmentCurrent: 2, installmentTotal: 5 })
    const ifood = database.select().from(transactions).where(eq(transactions.externalId, 't1')).get()!
    expect(ifood.categorySource).toBe('rule')
  })

  it('IA só vê o que as regras não resolveram, uma vez por descrição', async () => {
    const database = db()
    const seen: string[] = []
    const lazer = database.select().from(categories).where(eq(categories.name, 'Lazer')).get()!
    const provider: LLMProvider = {
      name: 'fake',
      async categorize(items) {
        seen.push(...items.map((i) => i.description))
        return items.map((i) => ({ ref: i.ref, categoryId: lazer.id }))
      }
    }
    await runImport(database, fakeAdapter(batch), provider)
    expect(seen.sort()).toEqual(['LOJA X', 'PADARIA'])
    // Segunda vez: tudo já categorizado, IA não é chamada.
    seen.length = 0
    await runImport(database, fakeAdapter(batch), provider)
    expect(seen).toEqual([])
  })

  it('correção manual vira regra e se propaga para descrições iguais', async () => {
    const database = db()
    await runImport(database, fakeAdapter(batch), null)
    const mercado = database.select().from(categories).where(eq(categories.name, 'Mercado')).get()!
    const padaria = database.select().from(transactions).where(eq(transactions.externalId, 't3')).get()!
    const affected = updateTransactionCategory(database, padaria.id, mercado.id)
    expect(affected).toBe(2)
    const learned = listRules(database).find((r) => r.origin === 'correction')
    expect(learned).toMatchObject({ pattern: 'PADARIA', matchType: 'exact', categoryId: mercado.id })
    const other = database.select().from(transactions).where(eq(transactions.externalId, 't4')).get()!
    expect(other).toMatchObject({ categoryId: mercado.id, categorySource: 'rule' })
    expect(database.select({ n: count() }).from(rules).where(eq(rules.origin, 'correction')).get()!.n).toBe(1)
  })
})
