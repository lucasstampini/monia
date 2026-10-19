import type { Rule } from '@shared/types'
import { normalizeDescription } from './normalize'

/** Verifica se uma regra casa com a descrição normalizada. Regex inválida nunca casa. */
export function ruleMatches(rule: Pick<Rule, 'pattern' | 'matchType'>, descriptionNorm: string): boolean {
  switch (rule.matchType) {
    case 'exact':
      return normalizeDescription(rule.pattern) === descriptionNorm
    case 'contains': {
      const needle = normalizeDescription(rule.pattern)
      return needle.length > 0 && descriptionNorm.includes(needle)
    }
    case 'regex':
      try {
        return new RegExp(rule.pattern, 'i').test(descriptionNorm)
      } catch {
        return false
      }
  }
}

/**
 * Ordem de avaliação: maior prioridade primeiro; empate, correções (aprendidas)
 * antes de regras manuais; depois a mais recente.
 */
export function sortRules<T extends Rule>(rules: T[]): T[] {
  return [...rules].sort(
    (a, b) =>
      b.priority - a.priority ||
      Number(b.origin === 'correction') - Number(a.origin === 'correction') ||
      b.id - a.id
  )
}

/** Retorna a primeira regra que casa (as regras já devem vir ordenadas). */
export function findMatchingRule<T extends Rule>(sortedRules: T[], descriptionNorm: string): T | null {
  return sortedRules.find((rule) => ruleMatches(rule, descriptionNorm)) ?? null
}
