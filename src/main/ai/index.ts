import type { AiProviderName } from '@shared/types'
import { createLogger } from '../logger'
import type { GenerateOptions, LLMClient } from './client'
import { GeminiClient } from './gemini'
import { OllamaClient } from './ollama'
import { categorizerFrom, type LLMProvider } from './provider'

export const DEFAULT_MODELS: Record<Exclude<AiProviderName, 'none'>, string> = {
  ollama: 'llama3.2',
  // Alias mantido pelo Google apontando para o Flash estável atual: não quebra quando um modelo é aposentado.
  gemini: 'gemini-flash-latest'
}

export interface ProviderConfig {
  provider: AiProviderName
  model: string
  ollamaUrl: string
  geminiApiKey: string | null
}

const log = createLogger('ai')

/** Escolhe o cliente de IA a partir das configurações (null = IA desativada). */
export function createClient(config: ProviderConfig): LLMClient | null {
  switch (config.provider) {
    case 'ollama':
      return withLogging(new OllamaClient(config.ollamaUrl, config.model || DEFAULT_MODELS.ollama))
    case 'gemini':
      if (!config.geminiApiKey) {
        log.warn('Gemini selecionado sem chave de API; IA desativada')
        return null
      }
      return withLogging(new GeminiClient(config.geminiApiKey, config.model || DEFAULT_MODELS.gemini))
    case 'none':
      return null
  }
}

/** Categorizador de transações sobre o cliente configurado. */
export function createProvider(config: ProviderConfig): LLMProvider | null {
  const client = createClient(config)
  return client ? categorizerFrom(client) : null
}

/**
 * Decorator: mesmo contrato de LLMClient, mas registra duração e tamanho do prompt.
 * O conteúdo do prompt e da resposta nunca vai para o log.
 */
function withLogging(client: LLMClient): LLMClient {
  return {
    name: client.name,
    model: client.model,
    async generateJson(prompt: string, options?: GenerateOptions) {
      const start = performance.now()
      const meta = { provider: client.name, model: client.model, promptChars: prompt.length }
      try {
        const result = await client.generateJson(prompt, options)
        log.info('chamada à IA ok', { ...meta, ms: Math.round(performance.now() - start) })
        return result
      } catch (error) {
        log.error('chamada à IA falhou', {
          ...meta,
          ms: Math.round(performance.now() - start),
          error: error instanceof Error ? error.message : String(error)
        })
        throw error
      }
    }
  }
}
