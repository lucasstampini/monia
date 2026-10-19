import { ipcMain, shell, type BrowserWindow } from 'electron'
import { z } from 'zod'
import { eventChannels, type InvokeApi } from '@shared/ipc'
import { createClient, createProvider } from '../ai'
import { adviseInvestments } from '../ai/investmentAdvisor'
import * as investmentQueries from '../db/investments'
import type { Db } from '../db/client'
import * as queries from '../db/queries'
import { PluggyAdapter } from '../ingestion/pluggy/adapter'
import { createLogger, logFilePath } from '../logger'
import { runImport } from '../pipeline/run'
import { getPluggyCredentials, getProviderConfig, getSettings, saveSettings, writeSetting } from '../settings'

const log = createLogger('ipc')

// Tudo que vem do renderer é tratado como entrada externa e validado com Zod.
const id = z.number().int().positive()
const filterSchema = z.object({
  search: z.string().max(200).optional(),
  accountId: id.optional(),
  categoryId: id.nullable().optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional()
})
const ruleSchema = z.object({
  id: id.optional(),
  pattern: z.string().trim().min(1).max(200),
  matchType: z.enum(['contains', 'regex', 'exact']),
  categoryId: id,
  priority: z.number().int().min(-1000).max(1000)
})
const categorySchema = z.object({
  id: id.optional(),
  name: z.string().trim().min(1, 'Dê um nome à categoria.').max(60),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  excludedFromSpending: z.boolean(),
  essential: z.boolean()
})
const krakenClassSchema = z.enum(['cash', 'reits', 'br_stocks', 'crypto', 'intl', 'opportunities'])
const percent = z.number().int().min(0).max(100)
const targetsSchema = z.object({
  cash: percent,
  reits: percent,
  br_stocks: percent,
  crypto: percent,
  intl: percent,
  opportunities: percent
})
const settingsSchema = z.object({
  pluggyClientId: z.string().max(200).optional(),
  pluggyClientSecret: z.string().max(500).optional(),
  pluggyItemIds: z.array(z.string().max(100)).max(50).optional(),
  aiProvider: z.enum(['none', 'ollama', 'gemini']).optional(),
  aiModel: z.string().max(100).optional(),
  ollamaUrl: z.url({ protocol: /^https?$/ }).optional(),
  geminiApiKey: z.string().max(500).optional()
})

type Handlers = { [K in keyof InvokeApi]: (...args: unknown[]) => ReturnType<InvokeApi[K]> | Awaited<ReturnType<InvokeApi[K]>> }

export function registerIpcHandlers(db: Db, getWindow: () => BrowserWindow | null, getAccent: () => string): void {
  let syncing = false

  const handlers: Handlers = {
    getAppearance: () => ({ accent: getAccent(), platform: process.platform }),
    listAccounts: () => queries.listAccounts(db),
    listCategories: () => queries.listCategories(db),
    listCategoryUsage: () => queries.listCategoryUsage(db),
    saveCategory: (input) => queries.saveCategory(db, categorySchema.parse(input)),
    deleteCategory: (categoryId, replacementId) =>
      queries.deleteCategory(db, id.parse(categoryId), id.nullable().parse(replacementId)),
    listMonths: () => queries.listMonths(db),
    listTransactions: (filter) => queries.listTransactions(db, filterSchema.parse(filter ?? {})),
    updateTransactionCategory: (transactionId, categoryId) => ({
      affected: queries.updateTransactionCategory(db, id.parse(transactionId), id.nullable().parse(categoryId))
    }),
    listReviewGroups: () => queries.listReviewGroups(db),
    categorizeGroup: (descriptionNorm, categoryId) => ({
      affected: queries.categorizeGroup(db, z.string().min(1).max(500).parse(descriptionNorm), id.parse(categoryId))
    }),
    listRules: () => queries.listRules(db),
    saveRule: (rule) => queries.saveRule(db, ruleSchema.parse(rule)),
    deleteRule: (ruleId) => queries.deleteRule(db, id.parse(ruleId)),
    getDashboard: (monthCount) => queries.getDashboard(db, z.number().int().min(1).max(36).parse(monthCount)),
    getSettings: () => getSettings(db),
    saveSettings: (input) => saveSettings(db, settingsSchema.parse(input)),
    sync: async () => {
      if (syncing) throw new Error('Já existe uma sincronização em andamento.')
      const credentials = getPluggyCredentials()
      const { pluggyItemIds } = getSettings(db)
      if (!credentials || pluggyItemIds.length === 0) {
        throw new Error('Configure as credenciais da Pluggy e ao menos uma conexão em Configurações.')
      }
      syncing = true
      try {
        const adapter = new PluggyAdapter({ credentials, itemIds: pluggyItemIds })
        const provider = createProvider(getProviderConfig(db))
        const result = await runImport(db, adapter, provider, (step) =>
          getWindow()?.webContents.send(eventChannels.onSyncProgress, { step })
        )
        writeSetting(db, 'lastSyncAt', new Date().toISOString())
        return result
      } finally {
        syncing = false
      }
    },
    getInvestments: () => investmentQueries.getInvestmentsOverview(db),
    setInvestmentClass: (investmentId, krakenClass) =>
      investmentQueries.setInvestmentClass(db, id.parse(investmentId), krakenClassSchema.nullable().parse(krakenClass)),
    saveAllocationTargets: (targets) => investmentQueries.saveAllocationTargets(db, targetsSchema.parse(targets)),
    getInvestmentAdvice: () => investmentQueries.getStoredAdvice(db),
    generateInvestmentAdvice: async () => {
      const client = createClient(getProviderConfig(db))
      if (!client) throw new Error('Configure um provedor de IA em Configurações para gerar sugestões.')
      const advice = await adviseInvestments(client, investmentQueries.getInvestmentsOverview(db))
      investmentQueries.storeAdvice(db, advice)
      return advice
    },
    revealLogs: () => {
      const file = logFilePath()
      if (file) shell.showItemInFolder(file)
    }
  }

  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, async (_event, ...args: unknown[]) => {
      try {
        return await handler(...args)
      } catch (error) {
        // Validação: devolve só a mensagem legível do primeiro problema, não o JSON do Zod.
        const friendly = error instanceof z.ZodError ? new Error(error.issues[0]?.message ?? 'Dados inválidos') : error
        // Argumentos não vão para o log: podem conter credenciais (saveSettings).
        log.error(`IPC ${channel} falhou`, { error: friendly instanceof Error ? friendly.message : String(friendly) })
        throw friendly
      }
    })
  }
}
