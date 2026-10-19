export interface GenerateOptions {
  /** Usado como "structured output" quando o provedor suporta. */
  jsonSchema?: object
  /** 0 = determinístico (categorização); um pouco mais para texto (conselhos). */
  temperature?: number
}

/**
 * Camada mais baixa da IA: manda um prompt e recebe texto JSON.
 * Gemini e Ollama implementam isto; categorização e conselhos de investimento
 * são construídos em cima, sem repetir código HTTP.
 */
export interface LLMClient {
  readonly name: string
  readonly model: string
  generateJson(prompt: string, options?: GenerateOptions): Promise<string>
}
