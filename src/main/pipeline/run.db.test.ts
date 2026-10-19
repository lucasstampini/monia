// Teste de integração com SQLite real (em memória).
// Roda com `npm run test:db`: o better-sqlite3 é compilado para o Node do Electron.
import { describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { count, eq } from 'drizzle-orm'
import type { LLMProvider } from '../ai/provider'
import { openDatabase } from '../db/client'
import { categorizeGroup, deleteCategory, deleteRule, listReviewGroups, listRules, updateTransactionCategory } from '../db/queries'
import * as schema from '../db/schema'
import { categories, rules, settings, transactions } from '../db/schema'
import { seed } from '../db/seed'
import { getInvestmentsOverview, saveAllocationTargets, setInvestmentClass } from '../db/investments'
import type { RawInvestment, RawTransaction, SourceAdapter, SourceBatch } from '../ingestion/types'
import { runImport } from './run'

function fakeAdapter(batch: Omit<SourceBatch, 'source' | 'errors'>): SourceAdapter {
  return { source: 'fake', fetch: async () => ({ source: 'fake', errors: [], ...structuredClone(batch) }) }
}

function tx(externalId: string, description: string, amountCents: number, extra: Partial<RawTransaction> = {}): RawTransaction {
  return {
    externalId,
    accountExternalId: 'card',
    date: '2024-05-01',
    description,
    amountCents,
    installmentCurrent: null,
    installmentTotal: null,
    statementMonth: '2024-06',
    sourceCategory: null,
    ...extra
  }
}

const batch = {
  accounts: [{ externalId: 'card', institution: 'Banco', name: 'Cartão', type: 'credit' as const, sourceItemId: null }],
  statements: [],
  investments: [] as RawInvestment[],
  transactions: [
    tx('t1', 'IFOOD *LANCHE', -3000),
    tx('t2', 'LOJA X PARC 02/05', -10000),
    tx('t3', 'CAFE DO PONTO', -800, { date: '2024-05-03' }),
    tx('t4', 'CAFE DO PONTO', -800, { date: '2024-05-04' })
  ]
}

const db = () => openDatabase(':memory:', 'drizzle')
const total = (database: ReturnType<typeof db>) => database.select({ n: count() }).from(transactions).get()!.n
const byExternal = (database: ReturnType<typeof db>, id: string) =>
  database.select().from(transactions).where(eq(transactions.externalId, id)).get()!

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
    expect(byExternal(database, 't2')).toMatchObject({ descriptionNorm: 'LOJA X', installmentCurrent: 2, installmentTotal: 5 })
    expect(byExternal(database, 't1').categorySource).toBe('rule')
  })

  it('usa a categoria da Pluggy quando nenhuma regra casa; Pix para terceiros fica para revisão', async () => {
    const database = db()
    await runImport(
      database,
      fakeAdapter({
        ...batch,
        transactions: [
          tx('p1', 'CORRIDA XPTO', -2000, { sourceCategory: 'Taxi and ride-hailing' }),
          tx('p2', 'TRANSFERENCIA ENVIADA PELO PIX FULANO', -5000, { sourceCategory: 'Transfer - PIX' }),
          tx('p3', 'TRANSFERENCIA RECEBIDA EU MESMO', 9000, { sourceCategory: 'Same person transfer - PIX' })
        ]
      }),
      null
    )
    const transporte = database.select().from(categories).where(eq(categories.name, 'Transporte')).get()!
    expect(byExternal(database, 'p1')).toMatchObject({ categoryId: transporte.id, categorySource: 'source' })
    expect(byExternal(database, 'p2').categoryId).toBeNull()
    expect(byExternal(database, 'p3').categorySource).toBe('source')
    expect(listReviewGroups(database).map((g) => g.descriptionNorm)).toEqual(['TRANSFERENCIA ENVIADA PELO PIX FULANO'])
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
    expect(seen.sort()).toEqual(['CAFE DO PONTO', 'LOJA X'])
    // Segunda vez: tudo já categorizado, IA não é chamada.
    seen.length = 0
    await runImport(database, fakeAdapter(batch), provider)
    expect(seen).toEqual([])
  })

  it('correção manual vira regra e se propaga para descrições iguais', async () => {
    const database = db()
    await runImport(database, fakeAdapter(batch), null)
    const mercado = database.select().from(categories).where(eq(categories.name, 'Mercado')).get()!
    const affected = updateTransactionCategory(database, byExternal(database, 't3').id, mercado.id)
    expect(affected).toBe(2)
    const learned = listRules(database).find((r) => r.origin === 'correction')
    expect(learned).toMatchObject({ pattern: 'CAFE DO PONTO', matchType: 'exact', categoryId: mercado.id })
    expect(byExternal(database, 't4')).toMatchObject({ categoryId: mercado.id, categorySource: 'rule' })
    expect(database.select({ n: count() }).from(rules).where(eq(rules.origin, 'correction')).get()!.n).toBe(1)
  })

  it('revisão em grupo categoriza todas as iguais e tira o grupo da fila', async () => {
    const database = db()
    await runImport(database, fakeAdapter(batch), null)
    expect(listReviewGroups(database).find((g) => g.descriptionNorm === 'CAFE DO PONTO')).toMatchObject({
      count: 2,
      totalCents: -1600
    })
    const alimentacao = database.select().from(categories).where(eq(categories.name, 'Alimentação')).get()!
    categorizeGroup(database, 'CAFE DO PONTO', alimentacao.id)
    expect(listReviewGroups(database).some((g) => g.descriptionNorm === 'CAFE DO PONTO')).toBe(false)
    expect(byExternal(database, 't4').categoryId).toBe(alimentacao.id)
  })
})

describe('excluir categoria', () => {
  const setup = async () => {
    const database = db()
    await runImport(database, fakeAdapter(batch), null)
    const alimentacao = database.select().from(categories).where(eq(categories.name, 'Alimentação')).get()!
    const mercado = database.select().from(categories).where(eq(categories.name, 'Mercado')).get()!
    return { database, alimentacao, mercado }
  }

  it('com substituta: transações e regras são movidas', async () => {
    const { database, alimentacao, mercado } = await setup()
    deleteCategory(database, alimentacao.id, mercado.id)
    expect(byExternal(database, 't1').categoryId).toBe(mercado.id)
    expect(database.select().from(rules).where(eq(rules.categoryId, alimentacao.id)).all()).toEqual([])
    expect(database.select().from(rules).where(eq(rules.pattern, 'IFOOD')).get()?.categoryId).toBe(mercado.id)
  })

  it('sem substituta: transações vão para revisão e regras são apagadas', async () => {
    const { database, alimentacao } = await setup()
    deleteCategory(database, alimentacao.id, null)
    expect(byExternal(database, 't1').categoryId).toBeNull()
    expect(database.select().from(rules).where(eq(rules.pattern, 'IFOOD')).get()).toBeUndefined()
    expect(listReviewGroups(database).some((g) => g.descriptionNorm === 'IFOOD LANCHE')).toBe(true)
  })
})

describe('investimentos', () => {
  const rdb = (balanceCents: number): RawInvestment => ({
    externalId: 'inv1',
    sourceItemId: 'item',
    institution: 'Banco',
    name: 'RDB',
    type: 'FIXED_INCOME',
    subtype: 'CDB',
    balanceCents,
    investedCents: 1_000_00,
    profitCents: balanceCents - 1_000_00,
    lastTwelveMonthsRate: 11,
    lastMonthRate: 0.9,
    rate: 100,
    rateType: 'CDI',
    fixedAnnualRate: null,
    dueDate: null,
    status: 'ACTIVE',
    updatedAt: '2026-10-18'
  })

  it('sincroniza posição, guarda um retrato por dia e preserva a classe escolhida', async () => {
    const database = db()
    await runImport(database, fakeAdapter({ ...batch, investments: [rdb(1_100_00)] }), null)
    let overview = getInvestmentsOverview(database)
    expect(overview.investments[0]).toMatchObject({ krakenClass: 'cash', krakenClassManual: false, balanceCents: 1_100_00 })

    setInvestmentClass(database, overview.investments[0]!.id, 'opportunities')
    // Mesmo dia, saldo novo: atualiza posição e retrato, sem duplicar.
    await runImport(database, fakeAdapter({ ...batch, investments: [rdb(1_200_00)] }), null)
    overview = getInvestmentsOverview(database)
    expect(overview.investments).toHaveLength(1)
    expect(overview.investments[0]).toMatchObject({ krakenClass: 'opportunities', krakenClassManual: true, balanceCents: 1_200_00 })
    expect(overview.history).toHaveLength(1)
    expect(overview.history[0]!.totalCents).toBe(1_200_00)
  })

  it('metas precisam somar 100%', () => {
    const database = db()
    expect(() =>
      saveAllocationTargets(database, { cash: 50, reits: 10, br_stocks: 10, crypto: 5, intl: 10, opportunities: 10 })
    ).toThrow('somar 100%')
    saveAllocationTargets(database, { cash: 50, reits: 10, br_stocks: 15, crypto: 5, intl: 10, opportunities: 10 })
    expect(getInvestmentsOverview(database).targetsDefined).toBe(true)
  })
})

describe('seed versionado', () => {
  it('banco antigo (v1) ganha as regras da v2 uma única vez', () => {
    const sqlite = new Database(':memory:')
    const raw = drizzle(sqlite, { schema })
    migrate(raw, { migrationsFolder: 'drizzle' })
    // Simula banco da v1: categorias existem, sem seedVersion.
    seed(raw)
    raw.delete(settings).run()
    raw.delete(rules).where(eq(rules.pattern, '99FOOD')).run()

    expect(seed(raw)).toBe(true)
    expect(raw.select().from(rules).where(eq(rules.pattern, '99FOOD')).get()).toBeDefined()

    // Regra apagada pelo usuário não volta.
    const rule = raw.select().from(rules).where(eq(rules.pattern, '99FOOD')).get()!
    deleteRule(raw, rule.id)
    expect(seed(raw)).toBe(false)
    expect(raw.select().from(rules).where(eq(rules.pattern, '99FOOD')).get()).toBeUndefined()
  })
})
