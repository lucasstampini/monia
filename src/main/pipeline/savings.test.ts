import { describe, expect, it } from 'vitest'
import { merchantKey, suggestSavings, type SavingsInput } from './savings'

const spend = (date: string, descriptionNorm: string, reais: number, categoryId: number | null = 1): SavingsInput => ({
  date,
  descriptionNorm,
  amountCents: -Math.round(reais * 100),
  categoryId,
  installmentTotal: null
})

/** `count` compras de `reais` em cada mês informado. */
function many(months: string[], description: string, count: number, reais: number, categoryId: number | null = 1) {
  return months.flatMap((m) => Array.from({ length: count }, (_, i) => spend(`${m}-${String(i + 1).padStart(2, '0')}`, description, reais, categoryId)))
}

describe('merchantKey', () => {
  it('junta as variações do mesmo estabelecimento', () => {
    expect(merchantKey('99')).toBe('99')
    expect(merchantKey('TRANSFERENCIA ENVIADA PELO PIX 99 TECNOLOGIA LTDA')).toBe('99')
    expect(merchantKey('UBER TRIP')).toBe('UBER')
    expect(merchantKey('IFOOD RESTAURANTE')).toBe('IFOOD')
    expect(merchantKey('MP HORADOROSH')).toBe('HORADOROSH')
  })
})

describe('suggestSavings', () => {
  const months = ['2026-07', '2026-08', '2026-09']

  it('hábito frequente vira sugestão de cortar pela metade', () => {
    const [first] = suggestSavings(many(months, '99', 20, 24), [], '2026-10')
    expect(first).toMatchObject({ kind: 'habit', label: '99', perMonth: 20, monthlyCents: 48000, potentialCents: 24000 })
  })

  it('variações do mesmo lugar contam juntas', () => {
    const txs = [...many(months, '99', 3, 20), ...many(months, 'TRANSFERENCIA ENVIADA PELO PIX 99 TECNOLOGIA LTDA', 2, 20)]
    const [first] = suggestSavings(txs, [], '2026-10')
    expect(first).toMatchObject({ kind: 'habit', perMonth: 5, monthlyCents: 10000 })
  })

  it('mesmo nome em categorias diferentes fica separado (Uber corrida x Uber Eats)', () => {
    const txs = [...many(months, 'UBER TRIP', 5, 20, 2), ...many(months, 'UBER EATS', 5, 40, 1)]
    const result = suggestSavings(txs, [], '2026-10')
    expect(result.map((s) => s.categoryId).sort()).toEqual([1, 2])
  })

  it('detecta gasto em alta no último mês fechado', () => {
    const txs = [
      ...many(['2026-06', '2026-07', '2026-08'], 'LOJA ROUPA', 1, 100, 3),
      ...many(['2026-09'], 'LOJA ROUPA', 1, 400, 3)
    ]
    const [first] = suggestSavings(txs, [], '2026-10')
    expect(first).toMatchObject({ kind: 'growth', lastMonthCents: 40000, baselineCents: 10000, potentialCents: 30000 })
  })

  it('ignora o que é pouco, parcelas, assinaturas e o mês atual', () => {
    const txs = [
      ...many(months, 'PADARIA', 2, 10),
      ...many(months, 'MAGALU', 6, 50).map((t) => ({ ...t, installmentTotal: 10 })),
      ...many(['2026-10'], 'IFOOD', 30, 50)
    ]
    expect(suggestSavings(txs, [], '2026-10')).toEqual([])
  })

  const charge = (descriptionNorm: string, averageCents: number, categoryId: number | null) => ({
    descriptionNorm,
    averageCents,
    occurrences: 3,
    lastDate: '2026-09-01',
    nextDate: '2026-10-01',
    categoryId
  })

  it('assinaturas ativas viram uma sugestão de revisão; essenciais e sem categoria ficam de fora', () => {
    const [first, ...rest] = suggestSavings(
      many(months, 'NETFLIX', 1, 55.9),
      [charge('NETFLIX', 5590, 7), charge('SPOTIFY', 2190, 7), charge('ALUGUEL', 250000, 9), charge('PIX FULANO', 30000, null)],
      '2026-10',
      new Set([9])
    )
    expect(first).toMatchObject({ kind: 'subscriptions', monthlyCents: 7780, potentialCents: 5590 })
    expect(first?.items?.map((i) => i.label)).toEqual(['NETFLIX', 'SPOTIFY'])
    expect(rest).toEqual([])
  })

  it('não sugere cortes em categoria essencial nem em gasto sem categoria', () => {
    const txs = [...many(months, 'SUPERMERCADO', 6, 100, 9), ...many(months, 'TRANSFERENCIA ENVIADA PELO PIX FULANO', 6, 50, null)]
    expect(suggestSavings(txs, [], '2026-10', new Set([9]))).toEqual([])
  })
})
