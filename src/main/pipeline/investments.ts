import { KRAKEN_CLASSES, type AllocationSlice, type KrakenClass } from '@shared/types'

const CRYPTO_NAME = /BITCOIN|CRIPTO|CRYPTO|ETHER|HASH11|QBTC|BITH11|QETH|BLOK/i

/**
 * Classe KRAKEN sugerida a partir do tipo/subtipo da Pluggy.
 * É só um ponto de partida: o usuário pode trocar a classe de cada investimento.
 * Null quando não dá para saber (ex.: previdência), e o investimento aparece como "sem classe".
 */
export function suggestKrakenClass(type: string, subtype: string | null, name: string): KrakenClass | null {
  if (CRYPTO_NAME.test(name)) return 'crypto'
  switch (type) {
    case 'FIXED_INCOME':
      return 'cash'
    case 'EQUITY':
      if (subtype === 'REAL_ESTATE_FUND') return 'reits'
      if (subtype === 'BDR') return 'intl'
      if (subtype === 'DERIVATIVES' || subtype === 'OPTION') return 'opportunities'
      return 'br_stocks'
    case 'ETF':
      return 'br_stocks'
    case 'MUTUAL_FUND':
      switch (subtype) {
        case 'STOCK_FUND':
        case 'ETF_FUND':
          return 'br_stocks'
        case 'FIXED_INCOME_FUND':
          return 'cash'
        case 'EXCHANGE_FUND':
        case 'OFFSHORE_FUND':
          return 'intl'
        default:
          return 'opportunities'
      }
    case 'COE':
      return 'opportunities'
    default:
      return null
  }
}

export interface AllocationInput {
  krakenClass: KrakenClass | null
  balanceCents: number
}

/**
 * Compara a carteira atual com as metas (%). Percentuais e lacunas são calculados
 * só sobre o que tem classe; o resto volta em `unclassifiedCents`.
 */
export function computeAllocation(
  holdings: AllocationInput[],
  targets: Partial<Record<KrakenClass, number>>
): { allocation: AllocationSlice[]; unclassifiedCents: number } {
  const byClass = new Map<KrakenClass, number>()
  let unclassifiedCents = 0
  for (const holding of holdings) {
    if (holding.krakenClass === null) unclassifiedCents += holding.balanceCents
    else byClass.set(holding.krakenClass, (byClass.get(holding.krakenClass) ?? 0) + holding.balanceCents)
  }
  const classifiedTotal = [...byClass.values()].reduce((sum, v) => sum + v, 0)

  const allocation = KRAKEN_CLASSES.map(({ key, label }) => {
    const valueCents = byClass.get(key) ?? 0
    const targetPercent = targets[key] ?? 0
    return {
      krakenClass: key,
      label,
      valueCents,
      currentPercent: classifiedTotal > 0 ? Math.round((valueCents / classifiedTotal) * 1000) / 10 : 0,
      targetPercent,
      gapCents: Math.round((classifiedTotal * targetPercent) / 100) - valueCents
    }
  })
  return { allocation, unclassifiedCents }
}
