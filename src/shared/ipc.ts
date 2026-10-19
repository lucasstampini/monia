// Contrato IPC: cada método vira um canal `ipcMain.handle(nome)`.
// O preload expõe exatamente esta interface em `window.api`.
import type {
  Account,
  Appearance,
  Category,
  CategoryInput,
  CategoryUsage,
  DashboardData,
  InvestmentAdvice,
  InvestmentsOverview,
  KrakenClass,
  MenuCommand,
  ReviewGroup,
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
  listCategoryUsage(): Promise<CategoryUsage[]>
  saveCategory(input: CategoryInput): Promise<Category>
  /** `replacementId` null: transações ficam sem categoria e as regras da categoria são apagadas. */
  deleteCategory(id: number, replacementId: number | null): Promise<void>
  listMonths(): Promise<string[]>
  listTransactions(filter: TransactionFilter): Promise<Transaction[]>
  updateTransactionCategory(transactionId: number, categoryId: number | null): Promise<{ affected: number }>
  listReviewGroups(): Promise<ReviewGroup[]>
  /** Categoriza todas as transações sem categoria com esta descrição e cria a regra correspondente. */
  categorizeGroup(descriptionNorm: string, categoryId: number): Promise<{ affected: number }>
  listRules(): Promise<Rule[]>
  saveRule(rule: RuleInput): Promise<Rule>
  deleteRule(id: number): Promise<void>
  getDashboard(monthCount: number): Promise<DashboardData>
  getSettings(): Promise<Settings>
  saveSettings(input: SettingsInput): Promise<Settings>
  sync(): Promise<SyncResult>
  getInvestments(): Promise<InvestmentsOverview>
  /** `null` volta para a classe sugerida pelo tipo do investimento. */
  setInvestmentClass(investmentId: number, krakenClass: KrakenClass | null): Promise<void>
  /** Metas em % inteiro por classe; precisam somar 100. */
  saveAllocationTargets(targets: Record<KrakenClass, number>): Promise<void>
  getInvestmentAdvice(): Promise<InvestmentAdvice | null>
  generateInvestmentAdvice(): Promise<InvestmentAdvice>
  /** Abre a pasta de logs no gerenciador de arquivos, com o arquivo selecionado. */
  revealLogs(): Promise<void>
}

export const invokeChannels = [
  'getAppearance',
  'listAccounts',
  'listCategories',
  'listCategoryUsage',
  'saveCategory',
  'deleteCategory',
  'listMonths',
  'listTransactions',
  'updateTransactionCategory',
  'listReviewGroups',
  'categorizeGroup',
  'listRules',
  'saveRule',
  'deleteRule',
  'getDashboard',
  'getSettings',
  'saveSettings',
  'sync',
  'getInvestments',
  'setInvestmentClass',
  'saveAllocationTargets',
  'getInvestmentAdvice',
  'generateInvestmentAdvice',
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
