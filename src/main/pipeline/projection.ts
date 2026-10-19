import type { ProjectedMonth, RecurringCharge } from '@shared/types'
import { addMonths, monthOf } from './normalize'

export interface ProjectionInput {
  accountId: number
  descriptionNorm: string
  amountCents: number
  installmentCurrent: number | null
  installmentTotal: number | null
  /** Competência: mês da fatura (cartão) ou da data (conta). */
  month: string
}

/**
 * Projeta os próximos meses a partir de:
 * - gastos já lançados com competência futura (ex.: fatura aberta);
 * - parcelas restantes de compras parceladas;
 * - assinaturas recorrentes detectadas.
 * Valores retornados são gasto positivo em centavos.
 */
export function projectMonths(
  transactions: ProjectionInput[],
  recurring: RecurringCharge[],
  currentMonth: string,
  monthCount: number
): ProjectedMonth[] {
  const months = Array.from({ length: monthCount }, (_, i) => addMonths(currentMonth, i))
  const result = new Map<string, ProjectedMonth>(
    months.map((month) => [month, { month, postedCents: 0, installmentsCents: 0, recurringCents: 0, totalCents: 0 }])
  )

  // Gastos já lançados nesses meses.
  for (const tx of transactions) {
    const entry = result.get(tx.month)
    if (entry && tx.amountCents < 0) entry.postedCents += -tx.amountCents
  }

  // Parcelas: cada compra parcelada vira uma série; usamos a parcela mais recente já lançada.
  const series = new Map<string, ProjectionInput>()
  for (const tx of transactions) {
    if (!tx.installmentCurrent || !tx.installmentTotal || tx.amountCents >= 0) continue
    const key = [tx.accountId, tx.descriptionNorm, tx.amountCents, tx.installmentTotal].join('|')
    const known = series.get(key)
    if (!known || tx.installmentCurrent > known.installmentCurrent!) series.set(key, tx)
  }
  for (const tx of series.values()) {
    for (let n = tx.installmentCurrent! + 1; n <= tx.installmentTotal!; n++) {
      const entry = result.get(addMonths(tx.month, n - tx.installmentCurrent!))
      if (entry) entry.installmentsCents += -tx.amountCents
    }
  }

  // Assinaturas: só nos meses em que ainda não foram cobradas.
  for (const charge of recurring) {
    for (const month of months) {
      if (month < monthOf(charge.nextDate)) continue
      const entry = result.get(month)!
      const alreadyPosted = transactions.some(
        (tx) => tx.month === month && tx.descriptionNorm === charge.descriptionNorm && tx.amountCents < 0
      )
      if (!alreadyPosted) entry.recurringCents += charge.averageCents
    }
  }

  for (const entry of result.values()) {
    entry.totalCents = entry.postedCents + entry.installmentsCents + entry.recurringCents
  }
  return months.map((month) => result.get(month)!)
}
