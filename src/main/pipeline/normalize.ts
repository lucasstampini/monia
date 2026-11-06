// Funções puras de normalização. Toda conversão "de fora para dentro" passa por aqui.

const TIME_ZONE = 'America/Sao_Paulo'

/**
 * Converte um valor decimal vindo de fora (ex.: 12.34 da API) em centavos inteiros.
 * É o único ponto onde um float de dinheiro é tocado; depois disso só inteiros.
 */
export function toCents(value: number): number {
  if (!Number.isFinite(value)) throw new Error(`Valor inválido: ${value}`)
  return Math.round(value * 100)
}

/** Converte um timestamp ISO (ex.: "2024-05-03T03:00:00.000Z") na data local de São Paulo. */
export function toLocalDate(isoDateTime: string): string {
  // Datas puras ("2024-05-03") já estão no formato certo e não devem sofrer fuso.
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDateTime)) return isoDateTime
  const instant = new Date(isoDateTime)
  if (Number.isNaN(instant.getTime())) throw new Error(`Data inválida: ${isoDateTime}`)
  // en-CA formata como YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(instant)
}

/** Mês (YYYY-MM) de uma data ISO. */
export function monthOf(date: string): string {
  return date.slice(0, 7)
}

/** Soma `count` meses a um mês YYYY-MM. */
export function addMonths(month: string, count: number): string {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number]
  const zeroBased = year * 12 + (monthNumber - 1) + count
  const newYear = Math.floor(zeroBased / 12)
  const newMonth = (zeroBased % 12) + 1
  return `${newYear}-${String(newMonth).padStart(2, '0')}`
}

/** Soma dias a uma data ISO, sem depender do fuso local da máquina. */
export function addDays(date: string, days: number): string {
  const utc = new Date(`${date}T00:00:00Z`)
  utc.setUTCDate(utc.getUTCDate() + days)
  return utc.toISOString().slice(0, 10)
}

/** Diferença em dias entre duas datas ISO. */
export function daysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)
  return Math.round(ms / 86_400_000)
}

/** Hoje em São Paulo. */
export function today(): string {
  return toLocalDate(new Date().toISOString())
}

const INSTALLMENT_PATTERN = /\b(PARC(ELA)?\.?\s*)?\d{1,2}\s*(\/|DE)\s*\d{1,2}\s*$/

/**
 * Limpa a descrição para comparação, regras e cache de IA:
 * remove acentos, marcadores de parcela, sequências longas de dígitos
 * (podem ser números de cartão/documento) e pontuação redundante.
 */
export function normalizeDescription(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\d{6,}/g, ' ')
    .replace(/[*_#|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(INSTALLMENT_PATTERN, '')
    .replace(/[\s\-.:,]+$/, '')
    .trim()
}

/**
 * Mês da fatura de uma compra no cartão, contado pelo **fechamento** (não pelo vencimento).
 * Compras a partir do dia de fechamento caem na fatura seguinte.
 * Ex.: fecha dia 24 -> compras de 24/09 a 23/10 são a fatura de outubro.
 */
export function statementMonthFor(purchaseDate: string, closeDay: number): string {
  const purchaseDay = Number(purchaseDate.slice(8, 10))
  return purchaseDay >= closeDay ? addMonths(monthOf(purchaseDate), 1) : monthOf(purchaseDate)
}

/**
 * Mês em que uma fatura fechou, a partir do vencimento: o último fechamento antes dele.
 * Ex.: fecha dia 24 -> vencimento 30/09 é a fatura de setembro; vencimento 02/11 é a de outubro.
 * O vencimento oscila (fim de semana, feriado); o fechamento não pula de mês.
 */
export function billMonthFor(dueDate: string, closeDay: number): string {
  const dueDay = Number(dueDate.slice(8, 10))
  return dueDay > closeDay ? monthOf(dueDate) : addMonths(monthOf(dueDate), -1)
}

/**
 * Dia de fechamento do cartão deduzido das faturas já fechadas:
 * cada fatura começa no dia do fechamento anterior, então o dia da compra mais antiga
 * de cada fatura é o fechamento. Usa o dia mais frequente, para tolerar exceções.
 */
export function inferCloseDay(purchases: { date: string; billId: string | null }[]): number | null {
  const firstDateByBill = new Map<string, string>()
  for (const { date, billId } of purchases) {
    if (!billId) continue
    const first = firstDateByBill.get(billId)
    if (!first || date < first) firstDateByBill.set(billId, date)
  }

  const countByDay = new Map<number, number>()
  for (const date of firstDateByBill.values()) {
    const day = Number(date.slice(8, 10))
    countByDay.set(day, (countByDay.get(day) ?? 0) + 1)
  }

  let closeDay: number | null = null
  for (const [day, count] of countByDay) {
    if (closeDay === null || count > countByDay.get(closeDay)!) closeDay = day
  }
  return closeDay
}
