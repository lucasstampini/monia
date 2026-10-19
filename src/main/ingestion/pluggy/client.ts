import { z } from 'zod'
import { authResponseSchema, itemSchema, pageSchema, type PluggyItem } from './schemas'

const BASE_URL = 'https://api.pluggy.ai'
const TIMEOUT_MS = 30_000

export interface PluggyCredentials {
  clientId: string
  clientSecret: string
}

/**
 * Cliente HTTP mínimo da Pluggy. Roda só no main (tem acesso ao segredo).
 * Mensagens de erro nunca incluem credenciais.
 */
export class PluggyClient {
  private apiKey: string | null = null

  constructor(private readonly credentials: PluggyCredentials) {}

  private async authenticate(): Promise<string> {
    const response = await fetch(`${BASE_URL}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.credentials),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })
    if (!response.ok) throw new Error(`Pluggy recusou as credenciais (HTTP ${response.status})`)
    const { apiKey } = authResponseSchema.parse(await response.json())
    this.apiKey = apiKey
    return apiKey
  }

  private async get(path: string): Promise<unknown> {
    const apiKey = this.apiKey ?? (await this.authenticate())
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: { 'X-API-KEY': apiKey },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })
    if (!response.ok) throw new Error(`Pluggy GET ${path.split('?')[0]} falhou (HTTP ${response.status})`)
    return response.json()
  }

  async getItem(itemId: string): Promise<PluggyItem> {
    return itemSchema.parse(await this.get(`/items/${encodeURIComponent(itemId)}`))
  }

  /** Busca todas as páginas de uma listagem. Itens ainda não validados. */
  async getAll(path: string, params: Record<string, string>): Promise<unknown[]> {
    const results: unknown[] = []
    let page = 1
    let totalPages = 1
    do {
      const query = new URLSearchParams({ ...params, page: String(page), pageSize: '500' })
      const body = pageSchema.parse(await this.get(`${path}?${query}`))
      results.push(...body.results)
      totalPages = body.totalPages ?? 1
      page++
    } while (page <= totalPages)
    return results
  }
}

/** Valida uma lista item a item: itens inválidos viram erro registrado, não exceção. */
export function parseEach<T>(schema: z.ZodType<T>, items: unknown[], label: string, errors: string[]): T[] {
  const valid: T[] = []
  items.forEach((item, index) => {
    const parsed = schema.safeParse(item)
    if (parsed.success) valid.push(parsed.data)
    else errors.push(`${label} #${index} ignorado: ${parsed.error.issues[0]?.message ?? 'formato inválido'}`)
  })
  return valid
}
