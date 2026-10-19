export interface Installment {
  current: number
  total: number
}

const PATTERNS = [
  // "PARC 03/10", "PARCELA 3 DE 10", "PARC.3/10"
  /PARC(?:ELA)?\.?\s*(\d{1,2})\s*(?:\/|DE)\s*(\d{1,2})/i,
  // "NETSHOES 3/10" no fim da descrição
  /\b(\d{1,2})\s*\/\s*(\d{1,2})\s*$/
]

/** Detecta parcela na descrição. Retorna null se não houver ou se for inconsistente. */
export function detectInstallment(description: string): Installment | null {
  for (const pattern of PATTERNS) {
    const match = description.match(pattern)
    if (!match) continue
    const current = Number(match[1])
    const total = Number(match[2])
    if (total >= 2 && current >= 1 && current <= total) return { current, total }
  }
  return null
}

/** Dado da fonte tem prioridade; a descrição é o plano B. */
export function resolveInstallment(
  description: string,
  fromSource: { current: number | null; total: number | null }
): Installment | null {
  if (fromSource.current && fromSource.total && fromSource.total >= 2) {
    return { current: fromSource.current, total: fromSource.total }
  }
  return detectInstallment(description)
}
