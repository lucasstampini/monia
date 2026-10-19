import type { RecurringCharge } from '@shared/types'
import { addDays, addMonths, daysBetween, monthOf } from './normalize'

export interface RecurringInput {
  descriptionNorm: string
  date: string
  amountCents: number
  installmentTotal: number | null
  categoryId?: number | null
}

const MIN_OCCURRENCES = 3
const MIN_INTERVAL_DAYS = 25
const MAX_INTERVAL_DAYS = 35
/** Sem cobrança há mais que isso (um ciclo + folga), consideramos cancelada. */
const INACTIVE_AFTER_DAYS = 45
/** Assinatura cobra uma vez por mês; muitas cobranças por mês (ex.: 99, iFood) é hábito, não assinatura. */
const MAX_CHARGES_PER_MONTH = 1.5
/** Assinaturas mudam pouco de valor; contas de consumo (mercado, luz) variam mais e ficam de fora. */
const AMOUNT_TOLERANCE = 0.05

/** Mesmo dia no mês seguinte; dia 31 vira o último dia do mês quando ele não existir. */
function sameDayNextMonth(date: string): string {
  const nextMonth = addMonths(monthOf(date), 1)
  const lastDayOfNextMonth = Number(addDays(`${addMonths(nextMonth, 1)}-01`, -1).slice(8, 10))
  const day = Math.min(Number(date.slice(8, 10)), lastDayOfNextMonth)
  return `${nextMonth}-${String(day).padStart(2, '0')}`
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle]! : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2)
}

/**
 * Detecta assinaturas: mesma descrição, gasto, valor estável (±5% da mediana)
 * e cobranças mensais (intervalo de 25 a 35 dias), em pelo menos 3 meses distintos.
 * Só entram as ativas: última cobrança há no máximo 45 dias de `today`.
 */
export function detectRecurring(transactions: RecurringInput[], today: string): RecurringCharge[] {
  const groups = new Map<string, RecurringInput[]>()
  for (const tx of transactions) {
    if (tx.amountCents >= 0 || tx.installmentTotal) continue
    const group = groups.get(tx.descriptionNorm) ?? []
    group.push(tx)
    groups.set(tx.descriptionNorm, group)
  }

  const charges: RecurringCharge[] = []
  for (const [descriptionNorm, group] of groups) {
    // Um lançamento por mês (o mais recente), para ignorar cobranças avulsas no mesmo mês.
    const byMonth = new Map<string, RecurringInput>()
    for (const tx of [...group].sort((a, b) => a.date.localeCompare(b.date))) byMonth.set(monthOf(tx.date), tx)
    const series = [...byMonth.values()]
    if (series.length < MIN_OCCURRENCES) continue
    if (group.length / series.length > MAX_CHARGES_PER_MONTH) continue

    const amounts = series.map((tx) => -tx.amountCents)
    const typical = median(amounts)
    const stableAmount = amounts.every((a) => Math.abs(a - typical) <= typical * AMOUNT_TOLERANCE)
    if (!stableAmount) continue

    const intervals = series.slice(1).map((tx, i) => daysBetween(series[i]!.date, tx.date))
    const monthly = intervals.every((d) => d >= MIN_INTERVAL_DAYS && d <= MAX_INTERVAL_DAYS)
    if (!monthly) continue

    const last = series[series.length - 1]!
    if (daysBetween(last.date, today) > INACTIVE_AFTER_DAYS) continue

    charges.push({
      descriptionNorm,
      averageCents: Math.round(amounts.reduce((sum, a) => sum + a, 0) / amounts.length),
      occurrences: series.length,
      lastDate: last.date,
      nextDate: sameDayNextMonth(last.date),
      categoryId: last.categoryId ?? null
    })
  }

  return charges.sort((a, b) => b.averageCents - a.averageCents)
}
