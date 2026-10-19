import { createLogger } from '../logger'

const log = createLogger('ai')

/** 429 (limite de uso) e 5xx (ex.: 503 "sobrecarregado") costumam passar sozinhos. */
function isTransient(status: number): boolean {
  return status === 429 || status >= 500
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * `fetch` com novas tentativas para erros temporários, esperando 1s, 2s, 4s...
 * Erros definitivos (400, 401, 404) voltam na hora: tentar de novo não resolveria.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit & { timeoutMs: number },
  attempts = 4
): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(init.timeoutMs) })
    if (response.ok || !isTransient(response.status) || attempt >= attempts) return response
    const waitMs = 1000 * 2 ** (attempt - 1)
    log.warn('erro temporário, tentando de novo', { status: response.status, attempt, waitMs })
    await sleep(waitMs)
  }
}

/** Mensagem de erro com o motivo dado pelo provedor (o corpo nunca contém a chave). */
export async function httpError(response: Response, model: string): Promise<Error> {
  const detail = (await response.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200)
  return new Error(`HTTP ${response.status} (modelo "${model}"): ${detail}`)
}
