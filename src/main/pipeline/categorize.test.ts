import { describe, expect, it } from 'vitest'
import type { Category, Rule } from '@shared/types'
import type { AnonymizedTransaction, LLMProvider } from '../ai/provider'
import { categorize } from './categorize'

const categories: Category[] = [
  { id: 1, name: 'Alimentação', parentId: null, color: '#FF9500' },
  { id: 2, name: 'Transporte', parentId: null, color: '#007AFF' }
]
const rules: Rule[] = [{ id: 1, pattern: 'UBER', matchType: 'contains', categoryId: 2, priority: 0, origin: 'manual' }]

function fakeProvider(answer: (t: AnonymizedTransaction) => number | null) {
  const calls: AnonymizedTransaction[][] = []
  const provider: LLMProvider = {
    name: 'fake',
    async categorize(transactions) {
      calls.push(transactions)
      return transactions.map((t) => ({ ref: t.ref, categoryId: answer(t) }))
    }
  }
  return { provider, calls }
}

const item = (descriptionNorm: string) => ({ descriptionNorm, amountCents: -1000, date: '2024-05-01' })

describe('categorize', () => {
  it('regras primeiro; IA só no que sobrou, uma vez por descrição', async () => {
    const { provider, calls } = fakeProvider(() => 1)
    const output = await categorize([item('UBER TRIP'), item('RESTAURANTE X'), item('RESTAURANTE X')], {
      rules,
      categories,
      aiCache: new Map(),
      provider
    })
    expect(output.results).toEqual([
      { categoryId: 2, source: 'rule' },
      { categoryId: 1, source: 'ai' },
      { categoryId: 1, source: 'ai' }
    ])
    expect(calls).toHaveLength(1)
    expect(calls[0]).toHaveLength(1)
    expect(output.newCacheEntries.get('RESTAURANTE X')).toBe(1)
  })

  it('usa o cache sem chamar a IA', async () => {
    const { provider, calls } = fakeProvider(() => 2)
    const output = await categorize([item('PADARIA')], {
      rules,
      categories,
      aiCache: new Map([['PADARIA', 1]]),
      provider
    })
    expect(output.results[0]).toEqual({ categoryId: 1, source: 'ai' })
    expect(calls).toHaveLength(0)
  })

  it('id inventado pela IA vira "Sem categoria"', async () => {
    const { provider } = fakeProvider(() => 999)
    const output = await categorize([item('LOJA')], { rules, categories, aiCache: new Map(), provider })
    expect(output.results[0]).toEqual({ categoryId: null, source: null })
  })

  it('falha da IA não derruba nada', async () => {
    const provider: LLMProvider = {
      name: 'quebrado',
      async categorize() {
        throw new Error('offline')
      }
    }
    const output = await categorize([item('LOJA')], { rules, categories, aiCache: new Map(), provider })
    expect(output.results[0]).toEqual({ categoryId: null, source: null })
    expect(output.errors[0]).toContain('offline')
  })

  it('usa a categoria da fonte antes da IA, mas regra vence', async () => {
    const { provider, calls } = fakeProvider(() => 1)
    const output = await categorize(
      [
        { ...item('99 TECNOLOGIA'), sourceCategory: 'Taxi and ride-hailing' },
        { ...item('UBER TRIP'), sourceCategory: 'Food delivery' }
      ],
      { rules, categories, aiCache: new Map(), provider }
    )
    expect(output.results).toEqual([
      { categoryId: 2, source: 'source' },
      { categoryId: 2, source: 'rule' }
    ])
    expect(calls).toHaveLength(0)
  })

  it('Pix para terceiros não é traduzido e segue para a IA', async () => {
    const { calls, provider } = fakeProvider(() => null)
    const output = await categorize([{ ...item('PIX FULANO'), sourceCategory: 'Transfer - PIX' }], {
      rules,
      categories,
      aiCache: new Map(),
      provider
    })
    expect(calls).toHaveLength(1)
    expect(output.results[0]).toEqual({ categoryId: null, source: null })
  })

  it('sem provedor, o que as regras não resolvem fica sem categoria', async () => {
    const output = await categorize([item('LOJA')], { rules, categories, aiCache: new Map(), provider: null })
    expect(output.results[0]).toEqual({ categoryId: null, source: null })
  })
})
