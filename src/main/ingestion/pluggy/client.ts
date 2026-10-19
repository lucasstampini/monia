import { z } from 'zod'
import { createLogger } from '../../logger'
import { authResponseSchema, cursorPageSchema, itemSchema, pageSchema, type PluggyItem } from './schemas'

const log = createLogger('pluggy')

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
    const start = performance.now()
    const response = await fetch(`${BASE_URL}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.credentials),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })
    log.info('POST /auth', { status: response.status, ms: Math.round(performance.now() - start) })
    if (!response.ok) throw new Error(`Pluggy recusou as credenciais (HTTP ${response.status})`)
    const { apiKey } = authResponseSchema.parse(await response.json())
    this.apiKey = apiKey
    return apiKey
  }

  private async get(path: string): Promise<unknown> {
    const apiKey = this.apiKey ?? (await this.authenticate())
    const start = performance.now()
    let response: Response
    try {
      response = await fetch(`${BASE_URL}${path}`, {
        headers: { 'X-API-KEY': apiKey },
        signal: AbortSignal.timeout(TIMEOUT_MS)
      })
    } catch (error) {
      // Timeout e falha de rede caem aqui.
      log.error(`GET ${path}`, { ms: Math.round(performance.now() - start), error: (error as Error).message })
      throw new Error(`Pluggy GET ${path.split('?')[0]} sem resposta: ${(error as Error).message}`)
    }
    const ms = Math.round(performance.now() - start)
    if (!response.ok) {
      // O corpo de erro da Pluggy traz código e motivo (ex.: ENDPOINT_DEPRECATED); não contém credenciais.
      const body = (await response.text().catch(() => '')).slice(0, 300)
      log.error(`GET ${path}`, { status: response.status, ms, body })
      throw new Error(`Pluggy GET ${path.split('?')[0]} falhou (HTTP ${response.status})`)
    }
    log.info(`GET ${path}`, { status: response.status, ms })
    return response.json()
  }

  async getItem(itemId: string): Promise<PluggyItem> {
    const item = itemSchema.parse(await this.get(`/items/${encodeURIComponent(itemId)}`))
    // Item em UPDATING/LOGIN_ERROR explica dados faltando ou desatualizados.
    log.info('item', { itemId, connector: item.connector.name, status: item.status ?? null })
    return item
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

  /**
   * Busca todas as páginas de uma listagem paginada por cursor (ex.: `/v2/transactions`).
   * Para quando `next` vem vazio, quando o cursor se repete ou num teto de segurança.
   */
  async getAllByCursor(path: string, params: Record<string, string>): Promise<unknown[]> {
    const results: unknown[] = []
    const seen = new Set<string>()
    let request: string | null = `${path}?${new URLSearchParams(params)}`
    for (let page = 0; page < MAX_CURSOR_PAGES; page++) {
      const body = cursorPageSchema.parse(await this.get(request))
      results.push(...body.results)
      request = nextPagePath(path, params, body.next)
      if (!request || seen.has(request)) return results
      seen.add(request)
    }
    log.warn('paginação por cursor atingiu o teto', { path, pages: MAX_CURSOR_PAGES })
    return results
  }
}

const MAX_CURSOR_PAGES = 1000

/**
 * Monta o caminho da próxima página a partir do `next` da resposta.
 * A Pluggy devolve `next` como query string relativa ("?accountId=...&after=...")
 * e pede que seja concatenada ao endpoint: GET /v2/transactions{next}.
 * Aceitamos também URL completa, caminho absoluto ou cursor puro, por robustez.
 */
export function nextPagePath(
  path: string,
  params: Record<string, string>,
  next: string | null | undefined
): string | null {
  if (!next) return null
  if (next.startsWith('?')) return `${path}${next}`
  if (next.startsWith('/')) return next
  if (/^https?:\/\//.test(next)) {
    const url = new URL(next)
    return `${url.pathname}${url.search}`
  }
  return `${path}?${new URLSearchParams({ ...params, after: next })}`
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
