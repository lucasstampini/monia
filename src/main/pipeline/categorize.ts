import type { Category, CategorySource, Rule } from '@shared/types'
import { anonymize } from '../ai/anonymize'
import type { LLMProvider } from '../ai/provider'
import { findMatchingRule } from './rules'
import { mapSourceCategory } from './sourceCategory'

export interface CategorizeItem {
  descriptionNorm: string
  amountCents: number
  date: string
  /** Categoria crua da fonte (Pluggy), se houver. */
  sourceCategory?: string | null
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
  /** Chamado antes de cada lote enviado à IA (lote atual começando em 1, total de lotes). */
  onBatch?: (batch: number, totalBatches: number) => void
}

export interface CategorizeOutput {
  results: CategoryResult[]
  /** Novas respostas da IA para gravar no cache. */
  newCacheEntries: Map<string, number | null>
  errors: string[]
}

const UNCATEGORIZED: CategoryResult = { categoryId: null, source: null }

/**
 * Camadas que não chamam a IA: regras -> categoria da fonte -> cache da IA.
 * Retorna `undefined` quando nenhuma camada sabe (candidato à IA);
 * `UNCATEGORIZED` quando a IA já respondeu "não sei" antes.
 */
export function resolveWithoutAi(
  item: CategorizeItem,
  context: Pick<CategorizeContext, 'rules' | 'categories' | 'aiCache'>
): CategoryResult | undefined {
  const rule = findMatchingRule(context.rules, item.descriptionNorm)
  if (rule) return { categoryId: rule.categoryId, source: 'rule' }

  const sourceName = mapSourceCategory(item.sourceCategory)
  const fromSource = sourceName ? context.categories.find((c) => c.name === sourceName) : undefined
  if (fromSource) return { categoryId: fromSource.id, source: 'source' }

  if (context.aiCache.has(item.descriptionNorm)) {
    const cached = context.aiCache.get(item.descriptionNorm) ?? null
    return cached === null ? UNCATEGORIZED : { categoryId: cached, source: 'ai' }
  }
  return undefined
}

/**
 * Categoriza em camadas: regras -> categoria da fonte -> cache da IA -> IA -> "Sem categoria".
 * A IA só vê o que as camadas anteriores não resolveram, e cada descrição é enviada uma única vez.
 */
export async function categorize(items: CategorizeItem[], context: CategorizeContext): Promise<CategorizeOutput> {
  const results: CategoryResult[] = items.map(() => UNCATEGORIZED)
  const newCacheEntries = new Map<string, number | null>()
  const errors: string[] = []
  const pendingByDescription = new Map<string, number[]>()

  items.forEach((item, index) => {
    const resolved = resolveWithoutAi(item, context)
    if (resolved) {
      results[index] = resolved
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

  const totalBatches = Math.ceil(descriptions.length / batchSize)
  for (let start = 0; start < descriptions.length; start += batchSize) {
    const batch = descriptions.slice(start, start + batchSize)
    context.onBatch?.(start / batchSize + 1, totalBatches)
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
