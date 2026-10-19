import { describe, expect, it } from 'vitest'
import { computeAllocation, computeInvestmentStats, suggestKrakenClass } from './investments'

describe('computeInvestmentStats', () => {
  const holdings = [
    { name: 'RDB', krakenClass: 'cash' as const, balanceCents: 50_000_00, profitCents: 3_000_00, dueDate: null },
    { name: 'IPCA 2035', krakenClass: 'cash' as const, balanceCents: 20_000_00, profitCents: 1_000_00, dueDate: '2035-05-15' },
    { name: 'CDB vencido', krakenClass: 'cash' as const, balanceCents: 5_000_00, profitCents: null, dueDate: '2025-01-01' },
    { name: 'LCI 2027', krakenClass: 'cash' as const, balanceCents: 10_000_00, profitCents: 500_00, dueDate: '2027-03-01' },
    { name: 'ITSA4', krakenClass: 'br_stocks' as const, balanceCents: 15_000_00, profitCents: -2_000_00, dueDate: null }
  ]
  const stats = computeInvestmentStats(holdings, '2026-10-19')

  it('soma rendimento por classe só com o que foi informado', () => {
    expect(stats.profitByClass).toEqual([
      { krakenClass: 'cash', label: 'Caixa e renda fixa', profitCents: 4_500_00 },
      { krakenClass: 'br_stocks', label: 'Ações Brasil', profitCents: -2_000_00 }
    ])
  })

  it('agrupa vencimentos por ano; vencido e sem data contam como liquidez', () => {
    expect(stats.maturities).toEqual([
      { year: '2027', valueCents: 10_000_00 },
      { year: '2035', valueCents: 20_000_00 }
    ])
    expect(stats.noMaturityCents).toBe(70_000_00)
  })

  it('mede concentração', () => {
    expect(stats).toMatchObject({ largestName: 'RDB', largestPercent: 50, top3Percent: 85 })
  })
})

describe('suggestKrakenClass', () => {
  it.each([
    ['FIXED_INCOME', 'CDB', 'RDB Nubank', 'cash'],
    ['EQUITY', 'REAL_ESTATE_FUND', 'HGLG11', 'reits'],
    ['EQUITY', 'STOCK', 'ITSA4', 'br_stocks'],
    ['EQUITY', 'BDR', 'AAPL34', 'intl'],
    ['MUTUAL_FUND', 'OFFSHORE_FUND', 'Fundo Global', 'intl'],
    ['MUTUAL_FUND', 'MULTIMARKET_FUND', 'Multimercado X', 'opportunities'],
    ['ETF', 'ETF', 'HASH11', 'crypto'],
    ['COE', 'STRUCTURED_NOTE', 'COE Bolsa', 'opportunities']
  ])('%s/%s %s -> %s', (type, subtype, name, expected) => {
    expect(suggestKrakenClass(type, subtype, name)).toBe(expected)
  })

  it('previdência e tipos desconhecidos ficam sem classe', () => {
    expect(suggestKrakenClass('SECURITY', 'PGBL', 'Prev')).toBeNull()
    expect(suggestKrakenClass('OTHER', null, 'Algo')).toBeNull()
  })
})

describe('computeAllocation', () => {
  it('calcula % atual e quanto falta para a meta, ignorando o sem classe', () => {
    const { allocation, unclassifiedCents } = computeAllocation(
      [
        { krakenClass: 'cash', balanceCents: 60_000_00 },
        { krakenClass: 'br_stocks', balanceCents: 40_000_00 },
        { krakenClass: null, balanceCents: 5_000_00 }
      ],
      { cash: 30, br_stocks: 40, intl: 30 }
    )
    expect(unclassifiedCents).toBe(5_000_00)
    const cash = allocation.find((a) => a.krakenClass === 'cash')!
    expect(cash).toMatchObject({ currentPercent: 60, targetPercent: 30, gapCents: -30_000_00 })
    const intl = allocation.find((a) => a.krakenClass === 'intl')!
    expect(intl).toMatchObject({ currentPercent: 0, gapCents: 30_000_00 })
    expect(allocation).toHaveLength(6)
  })

  it('carteira vazia não divide por zero', () => {
    const { allocation } = computeAllocation([], { cash: 100 })
    expect(allocation.every((a) => a.currentPercent === 0 && a.gapCents === 0)).toBe(true)
  })
})
