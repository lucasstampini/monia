import type { AnonymizedTransaction } from './provider'

const CPF = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g
const CNPJ = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/g
const LONG_DIGITS = /\d{5,}/g

/** Remove qualquer coisa com cara de documento, conta, cartão ou e-mail. */
export function scrubDescription(description: string): string {
  return description
    .replace(CNPJ, '[doc]')
    .replace(CPF, '[doc]')
    .replace(EMAIL, '[email]')
    .replace(LONG_DIGITS, '[num]')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Monta o payload que sai para a IA: só descrição normalizada (limpa), valor e data.
 * `ref` é um índice local; o id do banco nunca sai do app.
 */
export function anonymize(
  items: { descriptionNorm: string; amountCents: number; date: string }[]
): AnonymizedTransaction[] {
  return items.map((item, ref) => ({
    ref,
    description: scrubDescription(item.descriptionNorm),
    amountCents: item.amountCents,
    date: item.date
  }))
}
