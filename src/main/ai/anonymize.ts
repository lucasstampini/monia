import type { AnonymizedTransaction } from './provider'

const CPF = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g
const CNPJ = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/g
const LONG_DIGITS = /\d{5,}/g
// "TRANSFERENCIA RECEBIDA <nome>", "TRANSFERENCIA ENVIADA PELO PIX <nome>", "TED PARA <nome>"...
// Guarda o tipo da transferência (basta para categorizar) e captura o resto, que é a outra parte.
const TRANSFER_COUNTERPARTY =
  /^(.*?\b(?:PIX|TED|DOC|TRANSFERENCIA|TRANSF)\b(?: (?:ENVIADA|RECEBIDA|ENVIADO|RECEBIDO|PELO|VIA|DE|PARA|DO|DA|PIX|TED|DOC))*) .+$/i

/**
 * Remove qualquer coisa com cara de documento, conta, cartão ou e-mail,
 * e o nome de quem está do outro lado de uma transferência (pessoa ou empresa).
 */
export function scrubDescription(description: string): string {
  return description
    .replace(TRANSFER_COUNTERPARTY, '$1 [destinatario]')
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
