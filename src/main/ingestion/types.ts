import type { AccountType } from '@shared/types'

/**
 * Formato comum que todo adaptador de fonte produz.
 * O pipeline só conhece este tipo, nunca a fonte original.
 */
export interface RawTransaction {
  externalId: string | null
  /** Conta de origem, identificada pelo id externo da conta. */
  accountExternalId: string
  /** Data da compra, ISO YYYY-MM-DD no fuso America/Sao_Paulo. */
  date: string
  description: string
  /** Gasto negativo, crédito/estorno positivo. Centavos inteiros. */
  amountCents: number
  installmentCurrent: number | null
  installmentTotal: number | null
  /** Mês da fatura (YYYY-MM), quando a fonte souber. Não confundir com `date`. */
  statementMonth: string | null
}

export interface RawAccount {
  externalId: string
  institution: string
  name: string
  type: AccountType
  sourceItemId: string | null
}

export interface RawStatement {
  accountExternalId: string
  refMonth: string
  closeDate: string | null
  dueDate: string
  totalCents: number
}

export interface SourceBatch {
  source: string
  accounts: RawAccount[]
  transactions: RawTransaction[]
  statements: RawStatement[]
  /** Erros não fatais (uma linha ruim não derruba o import). */
  errors: string[]
}

export interface SourceAdapter {
  readonly source: string
  fetch(onProgress?: (step: string) => void): Promise<SourceBatch>
}
