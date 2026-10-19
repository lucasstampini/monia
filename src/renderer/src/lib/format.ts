// Formatação só acontece na UI. O resto do app trabalha com centavos e ISO.

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const compactCurrency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1
})

export function formatMoney(cents: number): string {
  return currency.format(cents / 100)
}

export function formatMoneyCompact(cents: number): string {
  return compactCurrency.format(cents / 100)
}

/** "2024-05-03" -> "03/05/2024", sem passar por fuso horário. */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}

const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const monthNamesLong = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro'
]

/** "2024-05" -> "mai/24" */
export function formatMonthShort(month: string): string {
  const [year, number] = month.split('-')
  return `${monthNames[Number(number) - 1]}/${year!.slice(2)}`
}

/** "2024-05" -> "maio de 2024" */
export function formatMonthLong(month: string): string {
  const [year, number] = month.split('-')
  return `${monthNamesLong[Number(number) - 1]} de ${year}`
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
}
