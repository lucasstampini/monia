import type { Category, CategorySource, Rule } from '@shared/types'
import { anonymize } from '../ai/anonymize'
import type { LLMProvider } from '../ai/provider'
import { findMatchingRule } from './rules'

export interface CategorizeItem {
  descriptionNorm: string
  amountCents: number
  date: string
}

export interface CategoryResult {
  categoryId: number | null
  source: CategorySource | null
}

export interface CategorizeContext {
  /** Regras já ordenadas por `sortRules`. */
  rules: Rule[]
  categories: Category[]
  /** Cache da IA por descrição normalizada (null = IA já respondeu "não sei"). */
  aiCache: Map<string, number | null>
  provider: LLMProvider | null
  batchSize?: number
}

export interface CategorizeOutput {
  results: CategoryResult[]
  /** Novas respostas da IA para gravar no cache. */
  newCacheEntries: Map<string, number | null>
  errors: string[]
}

const UNCATEGORIZED: CategoryResult = { categoryId: null, source: null }

/**
 * Categoriza em camadas: regras -> cache da IA -> IA -> "Sem categoria".
 * A IA só vê o que as regras não resolveram, e cada descrição é enviada uma única vez.
 */
export async function categorize(items: CategorizeItem[], context: CategorizeContext): Promise<CategorizeOutput> {
  const results: CategoryResult[] = items.map(() => UNCATEGORIZED)
  const newCacheEntries = new Map<string, number | null>()
  const errors: string[] = []
  const pendingByDescription = new Map<string, number[]>()

  items.forEach((item, index) => {
    const rule = findMatchingRule(context.rules, item.descriptionNorm)
    if (rule) {
      results[index] = { categoryId: rule.categoryId, source: 'rule' }
      return
    }
    if (context.aiCache.has(item.descriptionNorm)) {
      const cached = context.aiCache.get(item.descriptionNorm) ?? null
      results[index] = cached === null ? UNCATEGORIZED : { categoryId: cached, source: 'ai' }
      return
    }
    const indexes = pendingByDescription.get(item.descriptionNorm) ?? []
    indexes.push(index)
    pendingByDescription.set(item.descriptionNorm, indexes)
  })

  if (!context.provider || pendingByDescription.size === 0) {
    return { results, newCacheEntries, errors }
  }

  const validIds = new Set(context.categories.map((c) => c.id))
  const descriptions = [...pendingByDescription.keys()]
  const batchSize = context.batchSize ?? 40

  for (let start = 0; start < descriptions.length; start += batchSize) {
    const batch = descriptions.slice(start, start + batchSize)
    // Uma transação representativa por descrição.
    const samples = batch.map((description) => items[pendingByDescription.get(description)![0]!]!)
    const payload = anonymize(samples)

    try {
      const suggestions = await context.provider.categorize(payload, context.categories)
      const byRef = new Map(suggestions.map((s) => [s.ref, s.categoryId]))
      batch.forEach((description, ref) => {
        const raw = byRef.get(ref)
        const categoryId = raw !== undefined && raw !== null && validIds.has(raw) ? raw : null
        // Só cacheia o que a IA de fato respondeu; ausentes podem ser tentados de novo.
        if (raw !== undefined) newCacheEntries.set(description, categoryId)
        if (categoryId === null) return
        for (const index of pendingByDescription.get(description)!) {
          results[index] = { categoryId, source: 'ai' }
        }
      })
    } catch (error) {
      errors.push(`IA (${context.provider.name}): ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return { results, newCacheEntries, errors }
}
