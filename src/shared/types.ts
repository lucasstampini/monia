// Tipos compartilhados entre main, preload e renderer.
// Dinheiro sempre em centavos inteiros; datas em ISO YYYY-MM-DD; meses em YYYY-MM.

export type AccountType = 'credit' | 'checking'
/** `source` = categoria informada pela própria fonte (Pluggy), traduzida para as nossas. */
export type CategorySource = 'rule' | 'source' | 'ai' | 'manual'
export type MatchType = 'contains' | 'regex' | 'exact'
export type RuleOrigin = 'manual' | 'correction'
export type AiProviderName = 'none' | 'ollama' | 'gemini'

export interface Account {
  id: number
  institution: string
  name: string
  type: AccountType
}

export interface Category {
  id: number
  name: string
  parentId: number | null
  color: string
  /** Não entra nos gráficos de gasto/renda (ex.: pagamento de fatura, investimentos). */
  excludedFromSpending: boolean
}

export interface CategoryInput {
  id?: number
  name: string
  color: string
  excludedFromSpending: boolean
}

/** Quantas transações e regras usam cada categoria (para avisar antes de excluir). */
export interface CategoryUsage {
  categoryId: number
  transactions: number
  rules: number
}

export interface Transaction {
  id: number
  accountId: number
  accountName: string
  date: string
  descriptionRaw: string
  descriptionNorm: string
  amountCents: number
  installmentCurrent: number | null
  installmentTotal: number | null
  statementMonth: string | null
  categoryId: number | null
  categorySource: CategorySource | null
}

export interface TransactionFilter {
  search?: string
  accountId?: number
  /** `null` filtra "Sem categoria". */
  categoryId?: number | null
  /** Mês de competência (fatura para cartão, data para conta). */
  month?: string
}

/** Transações sem categoria agrupadas pela descrição normalizada, para revisão manual. */
export interface ReviewGroup {
  descriptionNorm: string
  /** Uma descrição original de exemplo, como aparece no extrato. */
  sampleDescription: string
  count: number
  totalCents: number
  lastDate: string
  accountNames: string
}

export interface Rule {
  id: number
  pattern: string
  matchType: MatchType
  categoryId: number
  priority: number
  origin: RuleOrigin
}

export type RuleInput = Omit<Rule, 'id' | 'origin'> & { id?: number }

export interface MonthSpending {
  month: string
  /** Gasto (positivo, em centavos) por id de categoria; chave "none" = sem categoria. */
  byCategory: Record<string, number>
  expenseCents: number
  incomeCents: number
}

export interface ProjectedMonth {
  month: string
  postedCents: number
  installmentsCents: number
  recurringCents: number
  totalCents: number
}

export interface RecurringCharge {
  descriptionNorm: string
  averageCents: number
  occurrences: number
  lastDate: string
  nextDate: string
}

export interface DashboardData {
  months: MonthSpending[]
  projection: ProjectedMonth[]
  subscriptions: RecurringCharge[]
}

export interface Settings {
  pluggyConfigured: boolean
  pluggyItemIds: string[]
  aiProvider: AiProviderName
  aiModel: string
  ollamaUrl: string
  geminiKeyConfigured: boolean
  lastSyncAt: string | null
}

export interface SettingsInput {
  pluggyClientId?: string
  pluggyClientSecret?: string
  pluggyItemIds?: string[]
  aiProvider?: AiProviderName
  aiModel?: string
  ollamaUrl?: string
  geminiApiKey?: string
}

export interface SyncResult {
  accounts: number
  received: number
  inserted: number
  updated: number
  errors: string[]
  categorizedByRule: number
  categorizedByAi: number
}

export interface SyncProgress {
  step: string
}

export interface Appearance {
  accent: string
  platform: string
}

export type MenuCommand =
  | 'search'
  | 'sync'
  | 'settings'
  | 'navigate-dashboard'
  | 'navigate-transactions'
  | 'navigate-review'
  | 'navigate-rules'
