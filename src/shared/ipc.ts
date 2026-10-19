// Contrato IPC: cada método vira um canal `ipcMain.handle(nome)`.
// O preload expõe exatamente esta interface em `window.api`.
import type {
  Account,
  Appearance,
  Category,
  DashboardData,
  MenuCommand,
  Rule,
  RuleInput,
  Settings,
  SettingsInput,
  SyncProgress,
  SyncResult,
  Transaction,
  TransactionFilter
} from './types'

export interface InvokeApi {
  getAppearance(): Promise<Appearance>
  listAccounts(): Promise<Account[]>
  listCategories(): Promise<Category[]>
  listMonths(): Promise<string[]>
  listTransactions(filter: TransactionFilter): Promise<Transaction[]>
  updateTransactionCategory(transactionId: number, categoryId: number | null): Promise<{ affected: number }>
  listRules(): Promise<Rule[]>
  saveRule(rule: RuleInput): Promise<Rule>
  deleteRule(id: number): Promise<void>
  getDashboard(monthCount: number): Promise<DashboardData>
  getSettings(): Promise<Settings>
  saveSettings(input: SettingsInput): Promise<Settings>
  sync(): Promise<SyncResult>
  /** Abre a pasta de logs no gerenciador de arquivos, com o arquivo selecionado. */
  revealLogs(): Promise<void>
}

export const invokeChannels = [
  'getAppearance',
  'listAccounts',
  'listCategories',
  'listMonths',
  'listTransactions',
  'updateTransactionCategory',
  'listRules',
  'saveRule',
  'deleteRule',
  'getDashboard',
  'getSettings',
  'saveSettings',
  'sync',
  'revealLogs'
] as const satisfies readonly (keyof InvokeApi)[]

/** Eventos que o main envia para o renderer. */
export interface EventApi {
  onMenuCommand(callback: (command: MenuCommand) => void): () => void
  onSyncProgress(callback: (progress: SyncProgress) => void): () => void
  onAccentChange(callback: (accent: string) => void): () => void
}

export const eventChannels = {
  onMenuCommand: 'menu-command',
  onSyncProgress: 'sync-progress',
  onAccentChange: 'accent-change'
} as const satisfies Record<keyof EventApi, string>

export type Api = InvokeApi & EventApi
