import { describe, expect, it } from 'vitest'
import type { Investment, InvestmentsOverview } from '@shared/types'
import type { LLMClient } from './client'
import { adviseInvestments, buildAdvicePrompt, buildPortfolioSummary } from './investmentAdvisor'

function investment(partial: Partial<Investment>): Investment {
  return {
    id: 1,
    institution: 'Nu Financeira',
    name: 'RDB Nubank Caixinha Viagem',
    type: 'FIXED_INCOME',
    subtype: 'CDB',
    krakenClass: 'cash',
    krakenClassManual: false,
    balanceCents: 10_000_00,
    investedCents: 9_000_00,
    profitCents: 1_000_00,
    lastTwelveMonthsRate: 11,
    lastMonthRate: 0.9,
    rate: 100,
    rateType: 'CDI',
    fixedAnnualRate: null,
    dueDate: '2027-01-10',
    updatedAt: '2026-10-18',
    ...partial
  }
}

const overview: InvestmentsOverview = {
  investments: [
    investment({}),
    investment({ id: 2, name: 'RDB Outro', balanceCents: 30_000_00, lastTwelveMonthsRate: 13, dueDate: '2026-12-01' })
  ],
  totalCents: 40_000_00,
  investedCents: 18_000_00,
  profitCents: 2_000_00,
  allocation: [],
  unclassifiedCents: 0,
  history: [],
  targetsDefined: false
}

describe('buildPortfolioSummary', () => {
  it('agrega por classe/tipo e não leva nome, instituição nem conta', () => {
    const summary = buildPortfolioSummary(overview)
    const text = JSON.stringify(summary)
    expect(text).not.toContain('Nubank')
    expect(text).not.toContain('Nu Financeira')
    expect(text).not.toContain('Caixinha')
    expect(summary.holdings).toEqual([
      {
        class: 'cash',
        type: 'FIXED_INCOME',
        subtype: 'CDB',
        count: 2,
        valueReais: 40000,
        // média ponderada pelo saldo: (11*10k + 13*30k) / 40k
        twelveMonthRatePercent: 12.5,
        rates: ['100% do CDI'],
        nearestDueDate: '2026-12-01'
      }
    ])
  })

  it('prompt deixa claro que metas não foram definidas', () => {
    expect(buildAdvicePrompt(buildPortfolioSummary(overview))).toContain('"targetsDefined": false')
  })
})

describe('adviseInvestments', () => {
  const client = (answer: string): LLMClient => ({ name: 'fake', model: 'm', generateJson: async () => answer })

  it('aceita resposta válida', async () => {
    const advice = await adviseInvestments(
      client(JSON.stringify({ insights: [{ title: 'Defina metas', detail: 'Sem metas não há comparação.', priority: 'alta' }] })),
      overview
    )
    expect(advice.insights).toHaveLength(1)
    expect(advice.provider).toBe('fake')
  })

  it('resposta fora do formato vira erro, nada é mostrado', async () => {
    await expect(adviseInvestments(client('{"insights":[{"title":"x"}]}'), overview)).rejects.toThrow('formato inválido')
    await expect(adviseInvestments(client('texto solto'), overview)).rejects.toThrow('formato inválido')
  })
})
