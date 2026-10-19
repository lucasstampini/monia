import { z } from 'zod'
import type { Category } from '@shared/types'
import {
  buildPrompt,
  categorizationJsonSchema,
  parseCategorization,
  type AnonymizedTransaction,
  type CategorySuggestion,
  type LLMProvider
} from './provider'

const responseSchema = z.object({ message: z.object({ content: z.string() }) })

/** Modelo local via Ollama: nada sai da máquina. */
export class OllamaProvider implements LLMProvider {
  readonly name = 'Ollama'

  constructor(
    private readonly baseUrl: string,
    private readonly model: string
  ) {}

  async categorize(transactions: AnonymizedTransaction[], categories: Category[]): Promise<CategorySuggestion[]> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        stream: false,
        format: categorizationJsonSchema,
        options: { temperature: 0 },
        messages: [{ role: 'user', content: buildPrompt(transactions, categories) }]
      }),
      signal: AbortSignal.timeout(120_000)
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const body = responseSchema.parse(await response.json())
    return parseCategorization(body.message.content, new Set(categories.map((c) => c.id)))
  }
}
