import { z } from 'zod'
import type { Category } from '@shared/types'
import { fetchWithRetry, httpError } from './http'
import {
  buildPrompt,
  parseCategorization,
  type AnonymizedTransaction,
  type CategorySuggestion,
  type LLMProvider
} from './provider'

const responseSchema = z.object({
  candidates: z
    .array(z.object({ content: z.object({ parts: z.array(z.object({ text: z.string() })) }) }))
    .min(1)
})

/** Gemini (Google AI Studio). Recebe só o payload anonimizado. */
export class GeminiProvider implements LLMProvider {
  readonly name = 'Gemini'

  constructor(
    private readonly apiKey: string,
    private readonly model: string
  ) {}

  async categorize(transactions: AnonymizedTransaction[], categories: Category[]): Promise<CategorySuggestion[]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildPrompt(transactions, categories) }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0 }
      }),
      timeoutMs: 60_000
    })
    if (!response.ok) throw await httpError(response, this.model)
    const body = responseSchema.parse(await response.json())
    const text = body.candidates[0]!.content.parts.map((p) => p.text).join('')
    return parseCategorization(text, new Set(categories.map((c) => c.id)))
  }
}
