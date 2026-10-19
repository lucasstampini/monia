import type { AiProviderName } from '@shared/types'
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

/** Escolhe a implementação de LLMProvider a partir das configurações. */
export function createProvider(config: ProviderConfig): LLMProvider | null {
  switch (config.provider) {
    case 'ollama':
      return new OllamaProvider(config.ollamaUrl, config.model || DEFAULT_MODELS.ollama)
    case 'gemini':
      return config.geminiApiKey ? new GeminiProvider(config.geminiApiKey, config.model || DEFAULT_MODELS.gemini) : null
    case 'none':
      return null
  }
}
