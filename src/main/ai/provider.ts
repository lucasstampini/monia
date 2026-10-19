import { z } from 'zod'
import type { Category } from '@shared/types'
import type { LLMClient } from './client'

/** O que pode sair do app rumo a uma IA: nada além disto. */
export interface AnonymizedTransaction {
  ref: number
  description: string
  amountCents: number
  date: string
}

export interface CategorySuggestion {
  ref: number
  categoryId: number | null
}

/** Interface única para qualquer modelo (Ollama local, Gemini, ...). */
export interface LLMProvider {
  readonly name: string
  categorize(transactions: AnonymizedTransaction[], categories: Category[]): Promise<CategorySuggestion[]>
}

/** Categorizador sobre qualquer cliente de IA: monta o prompt, pede JSON e valida a resposta. */
export function categorizerFrom(client: LLMClient): LLMProvider {
  return {
    name: client.name,
    async categorize(transactions, categories) {
      const raw = await client.generateJson(buildPrompt(transactions, categories), {
        jsonSchema: categorizationJsonSchema,
        temperature: 0
      })
      return parseCategorization(raw, new Set(categories.map((c) => c.id)))
    }
  }
}

/** Formato que exigimos da IA. Qualquer coisa fora disso é descartada. */
export const categorizationResponseSchema = z.object({
  results: z.array(
    z.object({
      ref: z.number().int(),
      categoryId: z.number().int().nullable()
    })
  )
})

/** JSON Schema equivalente, usado como "structured output" nos provedores que suportam. */
export const categorizationJsonSchema = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ref: { type: 'integer' },
          categoryId: { type: ['integer', 'null'] }
        },
        required: ['ref', 'categoryId']
      }
    }
  },
  required: ['results']
} as const

export function buildPrompt(transactions: AnonymizedTransaction[], categories: Category[]): string {
  const categoryList = categories.map((c) => `${c.id}: ${c.name}`).join('\n')
  const items = transactions
    .map((t) => `${t.ref} | ${t.date} | ${(t.amountCents / 100).toFixed(2)} | ${t.description}`)
    .join('\n')
  return [
    'Você categoriza transações financeiras brasileiras (cartão de crédito e conta corrente).',
    'Valores negativos são gastos; positivos são créditos/estornos/recebimentos.',
    'Escolha UMA categoria por transação usando o id da lista. Se não tiver confiança, use null. Não invente ids.',
    '',
    'Categorias (id: nome):',
    categoryList,
    '',
    'Transações (ref | data | valor | descrição):',
    items,
    '',
    'Responda somente JSON no formato {"results":[{"ref":0,"categoryId":1}]}, um item por ref.'
  ].join('\n')
}

/**
 * Valida a resposta crua da IA. Ids inexistentes viram null:
 * a IA nunca consegue criar categoria nem "chutar" fora da lista.
 */
export function parseCategorization(raw: string, validCategoryIds: Set<number>): CategorySuggestion[] {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return []
  }
  const parsed = categorizationResponseSchema.safeParse(json)
  if (!parsed.success) return []
  return parsed.data.results.map((r) => ({
    ref: r.ref,
    categoryId: r.categoryId !== null && validCategoryIds.has(r.categoryId) ? r.categoryId : null
  }))
}
