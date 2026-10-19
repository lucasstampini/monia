import { z } from 'zod'
import type { GenerateOptions, LLMClient } from './client'
import { httpError } from './http'

const responseSchema = z.object({ message: z.object({ content: z.string() }) })

/** Modelo local via Ollama: nada sai da máquina. */
export class OllamaClient implements LLMClient {
  readonly name = 'Ollama'

  constructor(
    private readonly baseUrl: string,
    readonly model: string
  ) {}

  async generateJson(prompt: string, options: GenerateOptions = {}): Promise<string> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        stream: false,
        format: options.jsonSchema ?? 'json',
        options: { temperature: options.temperature ?? 0 },
        messages: [{ role: 'user', content: prompt }]
      }),
      signal: AbortSignal.timeout(120_000)
    })
    if (!response.ok) throw await httpError(response, this.model)
    return responseSchema.parse(await response.json()).message.content
  }
}
