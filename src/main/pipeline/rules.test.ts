import { describe, expect, it } from 'vitest'
import type { Rule } from '@shared/types'
import { findMatchingRule, ruleMatches, sortRules } from './rules'

function rule(partial: Partial<Rule>): Rule {
  return { id: 1, pattern: '', matchType: 'contains', categoryId: 1, priority: 0, origin: 'manual', ...partial }
}

describe('ruleMatches', () => {
  it('contains normaliza o padrão', () => {
    expect(ruleMatches(rule({ pattern: 'ifood' }), 'IFD IFOOD.COM')).toBe(true)
  })

  it('exact compara a descrição inteira', () => {
    expect(ruleMatches(rule({ pattern: 'Uber', matchType: 'exact' }), 'UBER')).toBe(true)
    expect(ruleMatches(rule({ pattern: 'Uber', matchType: 'exact' }), 'UBER EATS')).toBe(false)
  })

  it('regex inválida nunca casa', () => {
    expect(ruleMatches(rule({ pattern: '(', matchType: 'regex' }), 'QUALQUER')).toBe(false)
    expect(ruleMatches(rule({ pattern: '^posto', matchType: 'regex' }), 'POSTO SHELL')).toBe(true)
  })
})

describe('findMatchingRule', () => {
  it('respeita prioridade e prefere correções no empate', () => {
    const rules = sortRules([
      rule({ id: 1, pattern: 'UBER', categoryId: 10 }),
      rule({ id: 2, pattern: 'UBER EATS', categoryId: 20, origin: 'correction' }),
      rule({ id: 3, pattern: 'UBER', categoryId: 30, priority: -1 })
    ])
    expect(findMatchingRule(rules, 'UBER EATS')?.categoryId).toBe(20)
    expect(findMatchingRule(rules, 'UBER TRIP')?.categoryId).toBe(10)
  })
})
