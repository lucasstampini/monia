import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, safeStorage } from 'electron'

export type SecretName = 'pluggyClientId' | 'pluggyClientSecret' | 'geminiApiKey'

/**
 * Segredos ficam num arquivo próprio, cada valor cifrado com `safeStorage`
 * (DPAPI no Windows, Keychain no macOS). Nunca em texto puro, nunca no renderer, nunca em log.
 */
function filePath(): string {
  return join(app.getPath('userData'), 'secrets.json')
}

function readStore(): Partial<Record<SecretName, string>> {
  if (!existsSync(filePath())) return {}
  try {
    return JSON.parse(readFileSync(filePath(), 'utf8')) as Partial<Record<SecretName, string>>
  } catch {
    return {}
  }
}

export function getSecret(name: SecretName): string | null {
  const encrypted = readStore()[name]
  if (!encrypted) return null
  try {
    return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
  } catch {
    return null
  }
}

export function hasSecret(name: SecretName): boolean {
  return Boolean(readStore()[name])
}

/** `null` ou string vazia apaga o segredo. */
export function setSecret(name: SecretName, value: string | null): void {
  const store = readStore()
  if (!value) {
    delete store[name]
  } else {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Criptografia do sistema indisponível; o segredo não foi salvo.')
    }
    store[name] = safeStorage.encryptString(value).toString('base64')
  }
  writeFileSync(filePath(), JSON.stringify(store), { mode: 0o600 })
}
