import { asc, eq, sql } from 'drizzle-orm'
import type { Investment, InvestmentAdvice, InvestmentsOverview, KrakenClass } from '@shared/types'
import { computeAllocation, suggestKrakenClass } from '../pipeline/investments'
import type { Db } from './client'
import { allocationTargets, investments, investmentSnapshots, settings } from './schema'

/**
 * Investimentos da carteira atual: para cada conexão, só os vistos no último sync dela.
 * (Um investimento resgatado deixa de vir da fonte e some daqui, mas o histórico fica.)
 */
function currentInvestments(db: Db) {
  const rows = db.select().from(investments).orderBy(asc(investments.name)).all()
  const latestByItem = new Map<string, string>()
  for (const row of rows) {
    const key = row.sourceItemId ?? ''
    if ((latestByItem.get(key) ?? '') < row.lastSeenAt) latestByItem.set(key, row.lastSeenAt)
  }
  return rows.filter((row) => row.lastSeenAt === latestByItem.get(row.sourceItemId ?? '') && row.balanceCents > 0)
}

export function getAllocationTargets(db: Db): Partial<Record<KrakenClass, number>> {
  return Object.fromEntries(
    db.select().from(allocationTargets).all().map((row) => [row.krakenClass, row.targetPercent])
  ) as Partial<Record<KrakenClass, number>>
}

export function getInvestmentsOverview(db: Db): InvestmentsOverview {
  const list: Investment[] = currentInvestments(db).map((row) => {
    const suggested = suggestKrakenClass(row.type, row.subtype, row.name)
    return {
      id: row.id,
      institution: row.institution,
      name: row.name,
      type: row.type,
      subtype: row.subtype,
      krakenClass: row.krakenClassOverride ?? suggested,
      krakenClassManual: row.krakenClassOverride !== null,
      balanceCents: row.balanceCents,
      investedCents: row.investedCents,
      profitCents: row.profitCents,
      lastTwelveMonthsRate: row.lastTwelveMonthsRate,
      lastMonthRate: row.lastMonthRate,
      rate: row.rate,
      rateType: row.rateType,
      fixedAnnualRate: row.fixedAnnualRate,
      dueDate: row.dueDate,
      updatedAt: row.updatedAt
    }
  })

  const targets = getAllocationTargets(db)
  const { allocation, unclassifiedCents } = computeAllocation(list, targets)
  const history = db
    .select({ date: investmentSnapshots.date, totalCents: sql<number>`sum(${investmentSnapshots.balanceCents})` })
    .from(investmentSnapshots)
    .groupBy(investmentSnapshots.date)
    .orderBy(asc(investmentSnapshots.date))
    .all()

  return {
    investments: list,
    totalCents: list.reduce((sum, i) => sum + i.balanceCents, 0),
    // Aplicado e rendimento só somam o que a fonte informou.
    investedCents: list.reduce((sum, i) => sum + (i.investedCents ?? 0), 0),
    profitCents: list.reduce((sum, i) => sum + (i.profitCents ?? 0), 0),
    allocation,
    unclassifiedCents,
    history,
    targetsDefined: Object.values(targets).some((v) => v > 0)
  }
}

const ADVICE_KEY = 'investmentAdvice'

/** Última sugestão da IA, guardada para não chamar a IA a cada abertura da tela. */
export function getStoredAdvice(db: Db): InvestmentAdvice | null {
  const row = db.select().from(settings).where(eq(settings.key, ADVICE_KEY)).get()
  if (!row) return null
  try {
    return JSON.parse(row.value) as InvestmentAdvice
  } catch {
    return null
  }
}

export function storeAdvice(db: Db, advice: InvestmentAdvice): void {
  const value = JSON.stringify(advice)
  db.insert(settings).values({ key: ADVICE_KEY, value }).onConflictDoUpdate({ target: settings.key, set: { value } }).run()
}

/** `null` volta para a classe sugerida pelo tipo. */
export function setInvestmentClass(db: Db, investmentId: number, krakenClass: KrakenClass | null): void {
  db.update(investments).set({ krakenClassOverride: krakenClass }).where(eq(investments.id, investmentId)).run()
}

export function saveAllocationTargets(db: Db, targets: Record<KrakenClass, number>): void {
  const total = Object.values(targets).reduce((sum, v) => sum + v, 0)
  if (total !== 100) throw new Error(`As metas precisam somar 100% (agora somam ${total}%).`)
  db.transaction((tx) => {
    for (const [krakenClass, targetPercent] of Object.entries(targets)) {
      tx.insert(allocationTargets)
        .values({ krakenClass, targetPercent })
        .onConflictDoUpdate({ target: allocationTargets.krakenClass, set: { targetPercent } })
        .run()
    }
  })
}
