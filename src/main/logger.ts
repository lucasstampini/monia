import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Logger mínimo: uma linha por evento em `<logs>/app.log`, também espelhada no console.
 * Nunca recebe segredos; por garantia, chaves com cara de credencial são mascaradas.
 */

type Level = 'info' | 'warn' | 'error'

const MAX_BYTES = 5 * 1024 * 1024
const SENSITIVE_KEY = /secret|password|token|apikey|api_key|clientid|client_id|authorization/i

let filePath: string | null = null

export function initLogger(directory: string): string {
  mkdirSync(directory, { recursive: true })
  filePath = join(directory, 'app.log')
  // Rotação simples: um arquivo atual e um anterior.
  if (existsSync(filePath) && statSync(filePath).size > MAX_BYTES) {
    renameSync(filePath, join(directory, 'app.old.log'))
  }
  return filePath
}

export function logFilePath(): string | null {
  return filePath
}

function redact(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(redact)
  if (data && typeof data === 'object') {
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, SENSITIVE_KEY.test(key) ? '[redacted]' : redact(value)])
    )
  }
  return data
}

function write(level: Level, scope: string, message: string, data?: Record<string, unknown>): void {
  const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} [${scope}] ${message}${
    data ? ` ${JSON.stringify(redact(data))}` : ''
  }`
  ;(level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(line)
  if (!filePath) return
  try {
    appendFileSync(filePath, `${line}\n`)
  } catch {
    // Falha de log nunca derruba o app.
  }
}

export function createLogger(scope: string) {
  return {
    info: (message: string, data?: Record<string, unknown>) => write('info', scope, message, data),
    warn: (message: string, data?: Record<string, unknown>) => write('warn', scope, message, data),
    error: (message: string, data?: Record<string, unknown>) => write('error', scope, message, data)
  }
}

/** Mede a duração de uma etapa assíncrona e registra início/fim. */
export async function timed<T>(
  logger: ReturnType<typeof createLogger>,
  label: string,
  run: () => Promise<T> | T,
  summarize?: (result: T) => Record<string, unknown>
): Promise<T> {
  const start = performance.now()
  try {
    const result = await run()
    logger.info(`${label} ok`, { ms: Math.round(performance.now() - start), ...summarize?.(result) })
    return result
  } catch (error) {
    logger.error(`${label} falhou`, {
      ms: Math.round(performance.now() - start),
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  }
}
