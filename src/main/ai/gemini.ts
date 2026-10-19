import { z } from 'zod'
import type { GenerateOptions, LLMClient } from './client'
import { fetchWithRetry, httpError } from './http'

const responseSchema = z.object({
  candidates: z
    .array(z.object({ content: z.object({ parts: z.array(z.object({ text: z.string() })) }) }))
    .min(1)
})

/** Gemini (Google AI Studio). Só recebe payloads já anonimizados. */
export class GeminiClient implements LLMClient {
  readonly name = 'Gemini'

  constructor(
    private readonly apiKey: string,
    readonly model: string
  ) {}

  async generateJson(prompt: string, options: GenerateOptions = {}): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: options.temperature ?? 0 }
      }),
      timeoutMs: 60_000
    })
    if (!response.ok) throw await httpError(response, this.model)
    const body = responseSchema.parse(await response.json())
    return body.candidates[0]!.content.parts.map((p) => p.text).join('')
  }
}
