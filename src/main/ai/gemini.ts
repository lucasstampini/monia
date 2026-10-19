import { z } from 'zod'
import type { Category } from '@shared/types'
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
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildPrompt(transactions, categories) }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0 }
      }),
      signal: AbortSignal.timeout(60_000)
    })
    if (!response.ok) {
      // O corpo explica o motivo (ex.: modelo inexistente). A chave vai no header, não aparece aqui.
      const detail = (await response.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200)
      throw new Error(`HTTP ${response.status} (modelo "${this.model}"): ${detail}`)
    }
    const body = responseSchema.parse(await response.json())
    const text = body.candidates[0]!.content.parts.map((p) => p.text).join('')
    return parseCategorization(text, new Set(categories.map((c) => c.id)))
  }
}
