import type { RecurringCharge, SavingSuggestion } from '@shared/types'
import { addMonths, monthOf } from './normalize'

export interface SavingsInput {
  date: string
  descriptionNorm: string
  amountCents: number
  categoryId: number | null
  installmentTotal: number | null
}

/** Hábito: pelo menos 4 compras por mês, somando ao menos R$ 80 por mês. */
const HABIT_MIN_PER_MONTH = 4
const HABIT_MIN_MONTHLY_CENTS = 8_000
/** Sugestão para hábitos: cortar pela metade. */
const HABIT_CUT = 0.5
/** Alta: último mês ao menos 40% e R$ 100 acima da média dos 3 anteriores. */
const GROWTH_RATIO = 1.4
const GROWTH_MIN_CENTS = 10_000
const MAX_SUGGESTIONS = 6

// Prefixos que escondem o nome do estabelecimento ("PIX 99 TECNOLOGIA" -> "99").
const PREFIXES = /^(TRANSFERENCIA ENVIADA PELO PIX|PAGAMENTO|COMPRA|PIX|PG|MP|EBW|PAG)\s+/

/** Chave do estabelecimento: primeira palavra da descrição sem prefixos de meio de pagamento. */
export function merchantKey(descriptionNorm: string): string {
  let text = descriptionNorm
  while (PREFIXES.test(text)) text = text.replace(PREFIXES, '')
  return text.split(' ')[0]?.replace(/[.,:;-]+$/, '') || descriptionNorm
}

interface Group {
  key: string
  categoryId: number | null
  /** Descrições e quantas vezes cada uma aparece, para escolher o rótulo. */
  labels: Map<string, number>
  byMonth: Map<string, { cents: number; count: number }>
}

/**
 * Sugere onde economizar a partir dos gastos dos últimos meses completos.
 * Ficam de fora:
 * - parcelas (já estão compromissadas);
 * - categorias essenciais (moradia, saúde...);
 * - o que ainda está sem categoria (ex.: Pix para pessoas, que precisa de revisão antes).
 * Assinaturas vêm de `recurring`. Valores retornados são gasto positivo, em centavos, por mês.
 */
export function suggestSavings(
  transactions: SavingsInput[],
  recurring: RecurringCharge[],
  currentMonth: string,
  essentialIds: Set<number> = new Set()
): SavingSuggestion[] {
  const cuttable = (categoryId: number | null | undefined): categoryId is number =>
    categoryId !== null && categoryId !== undefined && !essentialIds.has(categoryId)
  // Meses completos: o mês atual ainda está em andamento.
  const lastMonth = addMonths(currentMonth, -1)
  const recentMonths = [addMonths(currentMonth, -3), addMonths(currentMonth, -2), lastMonth]
  const baselineMonths = [addMonths(currentMonth, -4), addMonths(currentMonth, -3), addMonths(currentMonth, -2)]
  const recurringNames = new Set(recurring.map((r) => r.descriptionNorm))

  const groups = new Map<string, Group>()
  for (const tx of transactions) {
    if (tx.amountCents >= 0 || tx.installmentTotal || recurringNames.has(tx.descriptionNorm)) continue
    if (!cuttable(tx.categoryId)) continue
    const key = merchantKey(tx.descriptionNorm)
    const id = `${tx.categoryId ?? 'none'}|${key}`
    const group = groups.get(id) ?? { key, categoryId: tx.categoryId, labels: new Map(), byMonth: new Map() }
    group.labels.set(tx.descriptionNorm, (group.labels.get(tx.descriptionNorm) ?? 0) + 1)
    const month = monthOf(tx.date)
    const bucket = group.byMonth.get(month) ?? { cents: 0, count: 0 }
    bucket.cents += -tx.amountCents
    bucket.count += 1
    group.byMonth.set(month, bucket)
    groups.set(id, group)
  }

  const sum = (group: Group, months: string[], field: 'cents' | 'count') =>
    months.reduce((total, m) => total + (group.byMonth.get(m)?.[field] ?? 0), 0)

  const suggestions: SavingSuggestion[] = []
  for (const group of groups.values()) {
    const monthlyCents = Math.round(sum(group, recentMonths, 'cents') / recentMonths.length)
    const perMonth = sum(group, recentMonths, 'count') / recentMonths.length
    const label = [...group.labels.entries()].sort((a, b) => b[1] - a[1])[0]![0]
    const base = { label, categoryId: group.categoryId, monthlyCents, perMonth: Math.round(perMonth * 10) / 10 }

    const lastCents = group.byMonth.get(lastMonth)?.cents ?? 0
    const baselineCents = Math.round(sum(group, baselineMonths, 'cents') / baselineMonths.length)
    const growth = lastCents - baselineCents

    const habit = perMonth >= HABIT_MIN_PER_MONTH && monthlyCents >= HABIT_MIN_MONTHLY_CENTS
    const rising = baselineCents > 0 && lastCents >= baselineCents * GROWTH_RATIO && growth >= GROWTH_MIN_CENTS

    // Se for os dois, fica o de maior economia possível.
    const habitSaving = habit ? Math.round(monthlyCents * HABIT_CUT) : 0
    const growthSaving = rising ? growth : 0
    if (habitSaving === 0 && growthSaving === 0) continue
    if (habitSaving >= growthSaving) {
      suggestions.push({ ...base, kind: 'habit', potentialCents: habitSaving, lastMonthCents: lastCents, baselineCents })
    } else {
      suggestions.push({ ...base, kind: 'growth', potentialCents: growthSaving, lastMonthCents: lastCents, baselineCents })
    }
  }

  // Aluguel, plano de saúde etc. são recorrentes, mas não são "assinatura para cancelar".
  const subscriptions = recurring.filter((r) => cuttable(r.categoryId))
  if (subscriptions.length > 0) {
    const total = subscriptions.reduce((s, r) => s + r.averageCents, 0)
    suggestions.push({
      kind: 'subscriptions',
      label: subscriptions.length === 1 ? '1 assinatura ativa' : `${subscriptions.length} assinaturas ativas`,
      categoryId: null,
      monthlyCents: total,
      perMonth: subscriptions.length,
      // Estimativa conservadora: cancelar a mais cara.
      potentialCents: Math.max(...subscriptions.map((r) => r.averageCents)),
      lastMonthCents: total,
      baselineCents: total,
      items: subscriptions.map((r) => ({ label: r.descriptionNorm, cents: r.averageCents }))
    })
  }

  return suggestions.sort((a, b) => b.potentialCents - a.potentialCents).slice(0, MAX_SUGGESTIONS)
}
