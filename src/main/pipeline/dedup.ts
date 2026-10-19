import { createHash } from 'node:crypto'

export interface DedupInput {
  accountExternalId: string
  date: string
  amountCents: number
  descriptionNorm: string
}

function baseKey(tx: DedupInput): string {
  return [tx.accountExternalId, tx.date, tx.amountCents, tx.descriptionNorm].join('|')
}

/**
 * Gera o hash de deduplicação de cada transação do lote.
 *
 * Duas compras idênticas no mesmo dia (dois cafés iguais) são legítimas,
 * então cada repetição recebe um índice de ocorrência: "#0", "#1"...
 * Como o índice depende só do conteúdo do lote, reimportar o mesmo lote gera os mesmos hashes.
 */
export function dedupHashes(batch: DedupInput[]): string[] {
  const seen = new Map<string, number>()
  return batch.map((tx) => {
    const key = baseKey(tx)
    const occurrence = seen.get(key) ?? 0
    seen.set(key, occurrence + 1)
    return createHash('sha256').update(`${key}#${occurrence}`).digest('hex')
  })
}
