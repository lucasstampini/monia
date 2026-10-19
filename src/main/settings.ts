import { eq } from 'drizzle-orm'
import type { AiProviderName, Settings, SettingsInput } from '@shared/types'
import type { ProviderConfig } from './ai'
import type { Db } from './db/client'
import { settings } from './db/schema'
import { getSecret, hasSecret, setSecret } from './secrets'

type SettingKey = 'pluggyItemIds' | 'aiProvider' | 'aiModel' | 'ollamaUrl' | 'lastSyncAt'

function read(db: Db, key: SettingKey): string | null {
  return db.select().from(settings).where(eq(settings.key, key)).get()?.value ?? null
}

export function writeSetting(db: Db, key: SettingKey, value: string): void {
  db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } }).run()
}

export function getSettings(db: Db): Settings {
  const aiProvider = (read(db, 'aiProvider') ?? 'none') as AiProviderName
  return {
    pluggyConfigured: hasSecret('pluggyClientId') && hasSecret('pluggyClientSecret'),
    pluggyItemIds: JSON.parse(read(db, 'pluggyItemIds') ?? '[]') as string[],
    aiProvider,
    // Vazio = padrão do provedor (resolvido em createProvider), para o padrão poder evoluir.
    aiModel: read(db, 'aiModel') ?? '',
    ollamaUrl: read(db, 'ollamaUrl') ?? 'http://localhost:11434',
    geminiKeyConfigured: hasSecret('geminiApiKey'),
    lastSyncAt: read(db, 'lastSyncAt')
  }
}

/** Campos ausentes não mudam; segredos vão para o cofre cifrado. */
export function saveSettings(db: Db, input: SettingsInput): Settings {
  if (input.pluggyClientId !== undefined) setSecret('pluggyClientId', input.pluggyClientId.trim())
  if (input.pluggyClientSecret !== undefined) setSecret('pluggyClientSecret', input.pluggyClientSecret.trim())
  if (input.geminiApiKey !== undefined) setSecret('geminiApiKey', input.geminiApiKey.trim())
  if (input.pluggyItemIds !== undefined) {
    const ids = [...new Set(input.pluggyItemIds.map((id) => id.trim()).filter(Boolean))]
    writeSetting(db, 'pluggyItemIds', JSON.stringify(ids))
  }
  if (input.aiProvider !== undefined) writeSetting(db, 'aiProvider', input.aiProvider)
  if (input.aiModel !== undefined) writeSetting(db, 'aiModel', input.aiModel.trim())
  if (input.ollamaUrl !== undefined) writeSetting(db, 'ollamaUrl', input.ollamaUrl.trim())
  return getSettings(db)
}

export function getProviderConfig(db: Db): ProviderConfig {
  const current = getSettings(db)
  return {
    provider: current.aiProvider,
    model: current.aiModel,
    ollamaUrl: current.ollamaUrl,
    geminiApiKey: getSecret('geminiApiKey')
  }
}

export function getPluggyCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = getSecret('pluggyClientId')
  const clientSecret = getSecret('pluggyClientSecret')
  return clientId && clientSecret ? { clientId, clientSecret } : null
}
