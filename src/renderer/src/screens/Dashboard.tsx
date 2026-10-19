import { motion } from 'framer-motion'
import { BarChart3, CalendarClock, Repeat, Repeat2, TrendingUp, type LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Category, DashboardData, MonthSpending, SavingSuggestion } from '@shared/types'
import { CategoryLabel } from '../components/CategoryLabel'
import { Button } from '../components/controls'
import { EmptyState } from '../components/EmptyState'
import { SegmentedControl } from '../components/SegmentedControl'
import { Toolbar } from '../components/Toolbar'
import { formatDate, formatMoney, formatMoneyCompact, formatMonthLong, formatMonthShort } from '../lib/format'
import { softSpring } from '../lib/motion'
import { useAsync } from '../lib/useAsync'
import { useThemeColors, type ThemeColors } from '../lib/useThemeColors'

const PERIODS = [
  { value: 3, label: '3 meses' },
  { value: 6, label: '6 meses' },
  { value: 12, label: '12 meses' }
]

function Panel({ title, subtitle, children, className = '' }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-panel bg-control-bg p-4 shadow-[var(--shadow-control)] ${className}`}>
      <h2 className="font-semibold">{title}</h2>
      {subtitle && <p className="text-sm text-label-secondary">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

function StatTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-panel bg-control-bg px-4 py-3 shadow-[var(--shadow-control)]">
      <div className="text-sm text-label-secondary">{label}</div>
      <div className="mt-0.5 text-[22px] font-semibold leading-7">{value}</div>
      {detail && <div className="mt-0.5 text-xs text-label-secondary">{detail}</div>}
    </div>
  )
}

export function Dashboard({
  categories,
  dataVersion,
  hasAccounts,
  onSync
}: {
  categories: Category[]
  dataVersion: number
  hasAccounts: boolean
  onSync: () => void
}) {
  const [period, setPeriod] = useState(6)
  const dashboard = useAsync(() => window.api.getDashboard(period), [period, dataVersion])
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const colors = useThemeColors()

  const data = dashboard.data
  const currentMonth = data?.months.at(-1)
  const activeMonth = data?.months.find((m) => m.month === selectedMonth) ?? currentMonth

  useEffect(() => setSelectedMonth(null), [period])

  if (!hasAccounts) {
    return (
      <>
        <Toolbar title="Painel" />
        <EmptyState
          icon={BarChart3}
          title="Bem-vindo"
          message="Configure a Pluggy em Configurações e sincronize para ver gastos por categoria, por mês e a projeção da próxima fatura."
          action={
            <Button variant="primary" onClick={onSync}>
              Sincronizar
            </Button>
          }
        />
      </>
    )
  }

  const months = data?.months ?? []
  const average = months.length ? Math.round(months.reduce((s, m) => s + m.expenseCents, 0) / months.length) : 0
  const previous = months.at(-2)
  const delta = currentMonth && previous && previous.expenseCents > 0
    ? Math.round(((currentMonth.expenseCents - previous.expenseCents) / previous.expenseCents) * 100)
    : null
  const nextProjection = data?.projection[1]
  const subscriptionsTotal = data?.subscriptions.reduce((s, c) => s + c.averageCents, 0) ?? 0

  return (
    <>
      <Toolbar title="Painel" subtitle="Gastos por competência (mês da fatura no cartão)">
        <SegmentedControl ariaLabel="Período" options={PERIODS} value={period} onChange={setPeriod} />
      </Toolbar>

      <div className="flex-1 overflow-y-auto bg-grouped-bg p-5">
        {dashboard.error && <p className="mb-4 text-expense">{dashboard.error}</p>}
        {data && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={softSpring} className="mx-auto max-w-[1100px] space-y-4">
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <StatTile
                label={`Gasto em ${currentMonth ? formatMonthLong(currentMonth.month) : '—'}`}
                value={formatMoney(currentMonth?.expenseCents ?? 0)}
                detail={delta === null ? undefined : `${delta > 0 ? '+' : ''}${delta}% vs mês anterior`}
              />
              <StatTile label={`Média mensal (${period} meses)`} value={formatMoney(average)} />
              <StatTile
                label={nextProjection ? `Projeção de ${formatMonthLong(nextProjection.month)}` : 'Projeção'}
                value={formatMoney(nextProjection?.totalCents ?? 0)}
                detail="Lançado + parcelas + recorrentes"
              />
              <StatTile
                label="Recorrentes por mês"
                value={formatMoney(subscriptionsTotal)}
                detail={`${data.subscriptions.length} cobrança(s) detectada(s)`}
              />
            </div>

            {data.suggestions.length > 0 && <SavingsPanel suggestions={data.suggestions} categories={categories} />}

            <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
              <Panel title="Gasto por mês" subtitle="Clique num mês para ver as categorias">
                <MonthlyChart
                  months={months}
                  selected={activeMonth?.month ?? null}
                  onSelect={setSelectedMonth}
                  colors={colors}
                />
              </Panel>
              <Panel
                title="Por categoria"
                subtitle={activeMonth ? `${formatMonthLong(activeMonth.month)} · ${formatMoney(activeMonth.expenseCents)}` : undefined}
              >
                {activeMonth && <CategoryBreakdown month={activeMonth} categories={categories} />}
              </Panel>
            </div>

            <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
              <Panel title="Projeção das próximas faturas" subtitle="Inclui o que já foi lançado, parcelas restantes e cobranças recorrentes">
                <ProjectionTable projection={data.projection} />
              </Panel>
              <Panel title="Cobranças recorrentes" subtitle="Assinaturas e contas fixas: mesmo valor todo mês, por 3 meses ou mais">
                <Subscriptions data={data} />
              </Panel>
            </div>
          </motion.div>
        )}
      </div>
    </>
  )
}

const SUGGESTION_ICONS: Record<SavingSuggestion['kind'], LucideIcon> = {
  habit: Repeat2,
  growth: TrendingUp,
  subscriptions: CalendarClock
}

function suggestionText(s: SavingSuggestion): string {
  switch (s.kind) {
    case 'habit':
      return `${formatCount(s.perMonth)}× por mês, ${formatMoney(s.monthlyCents)}/mês em média. Usando metade das vezes, sobram ${formatMoney(s.potentialCents)}/mês.`
    case 'growth':
      return `${formatMoney(s.lastMonthCents)} no último mês, contra média de ${formatMoney(s.baselineCents)} nos 3 meses anteriores.`
    case 'subscriptions': {
      const top = [...(s.items ?? [])].sort((a, b) => b.cents - a.cents).slice(0, 3)
      return `${formatMoney(s.monthlyCents)}/mês no total. Maiores: ${top.map((i) => `${i.label} (${formatMoney(i.cents)})`).join(', ')}. Vale revisar o que você não usa.`
    }
  }
}

function formatCount(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

/** Sugestões calculadas localmente a partir dos últimos 3 meses completos. */
function SavingsPanel({ suggestions, categories }: { suggestions: SavingSuggestion[]; categories: Category[] }) {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const total = suggestions.reduce((sum, s) => sum + s.potentialCents, 0)
  return (
    <Panel
      title="Onde dá para economizar"
      subtitle={`Seguindo as sugestões, até ${formatMoney(total)} por mês (${formatMoney(total * 12)} por ano). Base: últimos 3 meses completos.`}
    >
      <ul className="divide-y divide-[var(--separator)]">
        {suggestions.map((s) => {
          const Icon = SUGGESTION_ICONS[s.kind]
          return (
            <li key={`${s.kind}-${s.label}-${s.categoryId}`} className="flex items-start gap-3 py-2.5">
              <Icon size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-accent" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{s.label}</span>
                  {s.categoryId !== null && (
                    <span className="shrink-0 text-sm text-label-secondary">
                      <CategoryLabel category={byId.get(s.categoryId)} />
                    </span>
                  )}
                </div>
                <p className="text-sm text-label-secondary">{suggestionText(s)}</p>
              </div>
              <div className="shrink-0 text-right">
                <div className="tabular font-semibold">−{formatMoney(s.potentialCents)}</div>
                <div className="text-xs text-label-secondary">por mês</div>
              </div>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

function MonthlyChart({
  months,
  selected,
  onSelect,
  colors
}: {
  months: MonthSpending[]
  selected: string | null
  onSelect: (month: string) => void
  colors: ThemeColors
}) {
  const chartData = months.map((m) => ({ month: m.month, label: formatMonthShort(m.month), value: m.expenseCents }))
  return (
    <div className="h-[240px]" role="img" aria-label="Gráfico de barras do gasto mensal">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke={colors.grid} />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: colors.grid }} tick={{ fill: colors.axis, fontSize: 11 }} />
          <YAxis
            tickFormatter={(value: number) => formatMoneyCompact(value)}
            tickLine={false}
            axisLine={false}
            width={64}
            tick={{ fill: colors.axis, fontSize: 11 }}
          />
          <Tooltip
            cursor={{ fill: colors.grid, opacity: 0.5 }}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as (typeof chartData)[number] | undefined
              if (!active || !point) return null
              return (
                <div className="rounded-control bg-window-bg px-2.5 py-1.5 text-sm shadow-[var(--shadow-panel)]">
                  <div className="text-label-secondary">{formatMonthLong(point.month)}</div>
                  <div className="tabular font-semibold">{formatMoney(point.value)}</div>
                </div>
              )
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} onClick={(entry) => onSelect((entry as unknown as { month: string }).month)} cursor="pointer">
            {chartData.map((point) => (
              <Cell key={point.month} fill={colors.series1} fillOpacity={point.month === selected ? 1 : 0.45} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Barras horizontais rotuladas: o nome identifica a categoria, não a cor. */
function CategoryBreakdown({ month, categories }: { month: MonthSpending; categories: Category[] }) {
  const byId = useMemo(() => new Map(categories.map((c) => [String(c.id), c])), [categories])
  const entries = Object.entries(month.byCategory)
    .map(([id, cents]) => ({ id, cents, category: byId.get(id) }))
    .sort((a, b) => b.cents - a.cents)
  const max = entries[0]?.cents ?? 0

  if (entries.length === 0) return <p className="text-label-secondary">Sem gastos neste mês.</p>

  return (
    <ul className="space-y-2.5">
      {entries.map((entry) => (
        <li key={entry.id}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <CategoryLabel category={entry.category} />
            <span className="tabular shrink-0">
              {formatMoney(entry.cents)}
              <span className="ml-1.5 text-xs text-label-secondary">
                {Math.round((entry.cents / month.expenseCents) * 100)}%
              </span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-fill-quaternary">
            <motion.div
              className="h-full rounded-full bg-[var(--chart-series-1)]"
              initial={{ width: 0 }}
              animate={{ width: `${(entry.cents / max) * 100}%` }}
              transition={softSpring}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

const PROJECTION_SERIES = [
  { key: 'postedCents', label: 'Lançado', color: 'var(--chart-series-1)' },
  { key: 'installmentsCents', label: 'Parcelas', color: 'var(--chart-series-2)' },
  { key: 'recurringCents', label: 'Recorrentes', color: 'var(--chart-series-3)' }
] as const

function ProjectionTable({ projection }: { projection: DashboardData['projection'] }) {
  const max = Math.max(...projection.map((p) => p.totalCents), 1)
  return (
    <>
      <div className="mb-2 flex gap-4 text-xs text-label-secondary" aria-hidden>
        {PROJECTION_SERIES.map((series) => (
          <span key={series.key} className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-sm" style={{ background: series.color }} />
            {series.label}
          </span>
        ))}
      </div>
      <table className="w-full text-left">
        <thead className="text-xs text-label-secondary">
          <tr>
            <th className="py-1 font-medium">Mês</th>
            <th className="w-full py-1 font-medium">
              <span className="sr-only">Composição</span>
            </th>
            {PROJECTION_SERIES.map((series) => (
              <th key={series.key} className="whitespace-nowrap px-2 py-1 text-right font-medium">
                {series.label}
              </th>
            ))}
            <th className="py-1 pl-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {projection.map((month) => (
            <tr key={month.month} className="border-t border-[var(--separator)]">
              <td className="whitespace-nowrap py-1.5 pr-3">{formatMonthShort(month.month)}</td>
              <td className="py-1.5">
                {/* Barra empilhada com 2px de respiro entre segmentos. */}
                <div className="flex h-2 gap-[2px]" style={{ width: `${(month.totalCents / max) * 100}%` }}>
                  {PROJECTION_SERIES.map((series) =>
                    month[series.key] > 0 ? (
                      <span
                        key={series.key}
                        className="h-full first:rounded-l-full last:rounded-r-full"
                        style={{ flexGrow: month[series.key], background: series.color }}
                      />
                    ) : null
                  )}
                </div>
              </td>
              {PROJECTION_SERIES.map((series) => (
                <td key={series.key} className="tabular whitespace-nowrap px-2 py-1.5 text-right text-label-secondary">
                  {formatMoney(month[series.key])}
                </td>
              ))}
              <td className="tabular whitespace-nowrap py-1.5 pl-2 text-right font-semibold">{formatMoney(month.totalCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function Subscriptions({ data }: { data: DashboardData }) {
  if (data.subscriptions.length === 0) {
    return <p className="text-label-secondary">Nenhuma cobrança recorrente encontrada ainda.</p>
  }
  return (
    <ul className="divide-y divide-[var(--separator)]">
      {data.subscriptions.map((charge) => (
        <li key={charge.descriptionNorm} className="flex items-center justify-between gap-3 py-1.5">
          <span className="flex min-w-0 items-center gap-2">
            <Repeat size={13} className="shrink-0 text-label-tertiary" />
            <span className="min-w-0">
              <span className="block truncate">{charge.descriptionNorm}</span>
              <span className="block text-xs text-label-secondary">Próxima por volta de {formatDate(charge.nextDate)}</span>
            </span>
          </span>
          <span className="tabular shrink-0">{formatMoney(charge.averageCents)}</span>
        </li>
      ))}
    </ul>
  )
}
