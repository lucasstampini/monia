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

/** "2024-05" -> "Maio de 2024" (para títulos e cabeçalhos). */
export function formatMonthTitle(month: string): string {
  const long = formatMonthLong(month)
  return long.charAt(0).toUpperCase() + long.slice(1)
}

const percent = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })

/** Percentual já em pontos (12.5 -> "12,5%"). */
export function formatPercent(value: number): string {
  return `${percent.format(value)}%`
}

/** Taxa contratada: "100% do CDI", "IPCA + 6% a.a.", "12% a.a.". */
export function formatContractRate(rate: number | null, rateType: string | null, fixedAnnualRate: number | null): string | null {
  if (rate !== null && rateType) {
    return `${formatPercent(rate)} do ${rateType}${fixedAnnualRate ? ` + ${formatPercent(fixedAnnualRate)} a.a.` : ''}`
  }
  if (rateType && fixedAnnualRate !== null) return `${rateType} + ${formatPercent(fixedAnnualRate)} a.a.`
  if (fixedAnnualRate !== null) return `${formatPercent(fixedAnnualRate)} a.a.`
  return null
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
}
