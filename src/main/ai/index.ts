import type { AiProviderName } from '@shared/types'
import { createLogger } from '../logger'
import { GeminiProvider } from './gemini'
import { OllamaProvider } from './ollama'
import type { LLMProvider } from './provider'

export const DEFAULT_MODELS: Record<Exclude<AiProviderName, 'none'>, string> = {
  ollama: 'llama3.2',
  gemini: 'gemini-2.5-flash'
}

export interface ProviderConfig {
  provider: AiProviderName
  model: string
  ollamaUrl: string
  geminiApiKey: string | null
}

const log = createLogger('ai')

/** Escolhe a implementação de LLMProvider a partir das configurações. */
export function createProvider(config: ProviderConfig): LLMProvider | null {
  switch (config.provider) {
    case 'ollama': {
      const model = config.model || DEFAULT_MODELS.ollama
      return withLogging(new OllamaProvider(config.ollamaUrl, model), model)
    }
    case 'gemini': {
      if (!config.geminiApiKey) {
        log.warn('Gemini selecionado sem chave de API; IA desativada neste sync')
        return null
      }
      const model = config.model || DEFAULT_MODELS.gemini
      return withLogging(new GeminiProvider(config.geminiApiKey, model), model)
    }
    case 'none':
      return null
  }
}

/**
 * Decorator: mesmo contrato de LLMProvider, mas registra tamanho do lote,
 * duração e quantas respostas vieram. Nenhum conteúdo das transações vai para o log.
 */
function withLogging(provider: LLMProvider, model: string): LLMProvider {
  return {
    name: provider.name,
    async categorize(transactions, categories) {
      const start = performance.now()
      try {
        const result = await provider.categorize(transactions, categories)
        log.info('lote categorizado', {
          provider: provider.name,
          model,
          sent: transactions.length,
          answered: result.filter((r) => r.categoryId !== null).length,
          ms: Math.round(performance.now() - start)
        })
        return result
      } catch (error) {
        log.error('lote falhou', {
          provider: provider.name,
          model,
          sent: transactions.length,
          ms: Math.round(performance.now() - start),
          error: error instanceof Error ? error.message : String(error)
        })
        throw error
      }
    }
  }
}
