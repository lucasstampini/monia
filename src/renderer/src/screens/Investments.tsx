import { motion } from 'framer-motion'
import { PiggyBank, RefreshCw, Sparkles, Target } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import {
  KRAKEN_CLASSES,
  type AllocationSlice,
  type Investment,
  type InvestmentAdvice,
  type InvestmentsOverview,
  type KrakenClass
} from '@shared/types'
import { Button, Select, TextField } from '../components/controls'
import { EmptyState } from '../components/EmptyState'
import { SegmentedControl } from '../components/SegmentedControl'
import { Sheet } from '../components/Sheet'
import { Toolbar } from '../components/Toolbar'
import { formatContractRate, formatDate, formatMoney, formatMoneyCompact, formatPercent } from '../lib/format'
import { softSpring } from '../lib/motion'
import { errorMessage, useAsync } from '../lib/useAsync'
import { useThemeColors } from '../lib/useThemeColors'

const CLASS_LABEL = Object.fromEntries(KRAKEN_CLASSES.map((c) => [c.key, c.label])) as Record<KrakenClass, string>
const AUTO = 'auto'

function Panel({
  title,
  subtitle,
  action,
  children
}: {
  title: React.ReactNode
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-panel bg-control-bg p-4 shadow-control">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {subtitle && <p className="text-sm text-label-secondary">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function StatTile({
  label,
  value,
  detail,
  tone
}: {
  label: string
  value: string
  detail?: string
  tone?: 'up' | 'down'
}) {
  return (
    <div className="rounded-panel bg-control-bg px-4 py-3 shadow-control">
      <div className="text-sm text-label-secondary">{label}</div>
      <div
        className={`tabular mt-1 text-[22px] font-medium leading-7 ${tone === 'up' ? 'text-income' : tone === 'down' ? 'text-expense' : ''}`}
      >
        {value}
      </div>
      {detail && <div className="mt-0.5 text-xs text-label-secondary">{detail}</div>}
    </div>
  )
}

export function Investments({ dataVersion, onSync }: { dataVersion: number; onSync: () => void }) {
  const [version, setVersion] = useState(0)
  const overview = useAsync(() => window.api.getInvestments(), [dataVersion, version])
  const reload = () => setVersion((v) => v + 1)
  const [editingTargets, setEditingTargets] = useState(false)
  const [view, setView] = useState<'dashboard' | 'positions'>('dashboard')
  const data = overview.data

  if (data && data.investments.length === 0) {
    return (
      <>
        <Toolbar title="Investimentos" />
        <EmptyState
          icon={PiggyBank}
          title="Nenhum investimento ainda"
          message="Sincronize para trazer os investimentos das suas conexões do Meu Pluggy."
          action={
            <Button variant="primary" onClick={onSync}>
              Sincronizar
            </Button>
          }
        />
      </>
    )
  }

  const lastUpdate = data?.investments
    .map((i) => i.updatedAt)
    .filter(Boolean)
    .sort()
    .at(-1)
  const profitPercent = data && data.investedCents > 0 ? (data.profitCents / data.investedCents) * 100 : null
  const weighted12m = data ? weightedTwelveMonthRate(data.investments) : null

  return (
    <>
      <Toolbar
        title="Investimentos"
        subtitle={lastUpdate ? `Posição de ${formatDate(lastUpdate)}, informada pela instituição` : undefined}
      >
        <SegmentedControl
          ariaLabel="Visualização"
          options={[
            { value: 'dashboard' as const, label: 'Painel' },
            { value: 'positions' as const, label: 'Posições' }
          ]}
          value={view}
          onChange={setView}
        />
      </Toolbar>
      <div className="flex-1 overflow-y-auto bg-grouped-bg p-5">
        {overview.error && <p className="mb-4 text-expense">{overview.error}</p>}
        {data && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={softSpring}
            className="mx-auto max-w-[1100px] space-y-4"
          >
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <StatTile
                label="Patrimônio"
                value={formatMoney(data.totalCents)}
                detail={`${data.investments.length} posições`}
              />
              <StatTile
                label="Valor aplicado"
                value={formatMoney(data.investedCents)}
                detail="Quando a instituição informa"
              />
              <StatTile
                label="Rendimento"
                value={formatMoney(data.profitCents)}
                detail={
                  profitPercent !== null
                    ? `${formatPercent(Math.round(profitPercent * 100) / 100)} sobre o aplicado`
                    : undefined
                }
                tone={data.profitCents > 0 ? 'up' : data.profitCents < 0 ? 'down' : undefined}
              />
              <StatTile
                label="Rentabilidade 12 meses"
                value={weighted12m !== null ? formatPercent(weighted12m) : '—'}
                detail="Média ponderada pelo saldo"
              />
            </div>

            {view === 'positions' ? (
              <Holdings investments={data.investments} onChanged={reload} />
            ) : (
              <>
                <div className="grid gap-4 lg:grid-cols-2">
                  <Panel
                    title="Distribuição por classe"
                    subtitle={
                      data.stats.largestName
                        ? `Maior posição: ${data.stats.largestName} (${formatPercent(data.stats.largestPercent)}) · 3 maiores: ${formatPercent(data.stats.top3Percent)}`
                        : undefined
                    }
                  >
                    <ClassDonut allocation={data.allocation} totalCents={data.totalCents - data.unclassifiedCents} />
                  </Panel>
                  <Panel
                    title="Atual × meta KRAKEN"
                    subtitle={
                      data.targetsDefined
                        ? 'Carteira atual comparada às suas metas'
                        : 'Defina as metas de cada classe para comparar'
                    }
                    action={
                      <Button onClick={() => setEditingTargets(true)}>
                        <Target size={13} /> {data.targetsDefined ? 'Editar metas' : 'Definir metas'}
                      </Button>
                    }
                  >
                    <AllocationList allocation={data.allocation} targetsDefined={data.targetsDefined} />
                    {data.unclassifiedCents > 0 && (
                      <p className="mt-3 text-sm text-label-secondary">
                        {formatMoney(data.unclassifiedCents)} sem classe ficam fora da alocação. Escolha a classe em
                        Posições.
                      </p>
                    )}
                  </Panel>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Panel title="Rendimento por classe" subtitle="Ganho acumulado informado pela instituição">
                    <ProfitByClassChart stats={data.stats} />
                  </Panel>
                  <Panel
                    title="Vencimentos"
                    subtitle="Quanto fica disponível e quando: liquidez hoje e por ano de vencimento"
                  >
                    <MaturityChart stats={data.stats} />
                  </Panel>
                </div>

                {data.history.length >= 2 && (
                  <Panel title="Evolução do patrimônio" subtitle="Um ponto por dia sincronizado">
                    <HistoryChart history={data.history} />
                  </Panel>
                )}

                <AdvicePanel dataVersion={dataVersion} />
              </>
            )}
          </motion.div>
        )}
      </div>

      {data && (
        <TargetsSheet
          open={editingTargets}
          allocation={data.allocation}
          onClose={() => setEditingTargets(false)}
          onSaved={() => {
            setEditingTargets(false)
            reload()
          }}
        />
      )}
    </>
  )
}

function weightedTwelveMonthRate(list: Investment[]): number | null {
  const rated = list.filter((i) => i.lastTwelveMonthsRate !== null)
  const total = rated.reduce((sum, i) => sum + i.balanceCents, 0)
  if (total === 0) return null
  const value = rated.reduce((sum, i) => sum + i.lastTwelveMonthsRate! * i.balanceCents, 0) / total
  return Math.round(value * 100) / 100
}

/** Barra da posição atual com um traço na meta; o texto diz quanto falta ou sobra. */
function AllocationList({ allocation, targetsDefined }: { allocation: AllocationSlice[]; targetsDefined: boolean }) {
  return (
    <ul className="space-y-3">
      {allocation.map((slice) => (
        <li key={slice.krakenClass}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span>{slice.label}</span>
            <span className="tabular text-sm">
              <span className="font-medium">{formatPercent(slice.currentPercent)}</span>
              {targetsDefined && <span className="text-label-secondary"> de {formatPercent(slice.targetPercent)}</span>}
              <span className="ml-2 text-label-secondary">{formatMoney(slice.valueCents)}</span>
            </span>
          </div>
          <div className="relative h-2 rounded-full bg-fill-quaternary">
            <motion.div
              className="h-full rounded-full bg-[var(--chart-primary)]"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, slice.currentPercent)}%` }}
              transition={softSpring}
            />
            {targetsDefined && (
              <span
                aria-hidden
                className="absolute -top-0.5 h-3 w-0.5 rounded-full bg-label"
                style={{ left: `calc(${Math.min(100, slice.targetPercent)}% - 1px)` }}
              />
            )}
          </div>
          {targetsDefined && slice.gapCents !== 0 && (
            <p className="mt-1 text-xs text-label-secondary">
              {slice.gapCents > 0
                ? `Faltam ${formatMoney(slice.gapCents)} para a meta`
                : `${formatMoney(-slice.gapCents)} acima da meta`}
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}

const PRIORITY_STYLE: Record<string, string> = {
  alta: 'bg-[color-mix(in_srgb,var(--system-red)_15%,transparent)] text-expense',
  media: 'bg-fill-tertiary text-label',
  baixa: 'bg-fill-quaternary text-label-secondary'
}

/** Sugestões geradas por IA, sempre identificadas como tal. Só são geradas quando o usuário pede. */
function AdvicePanel({ dataVersion }: { dataVersion: number }) {
  const stored = useAsync(() => window.api.getInvestmentAdvice(), [dataVersion])
  const [advice, setAdvice] = useState<InvestmentAdvice | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const current = advice ?? stored.data ?? null

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      setAdvice(await window.api.generateInvestmentAdvice())
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Panel
      title={
        <span className="inline-flex items-center gap-1.5">
          <Sparkles size={14} className="text-accent" /> O que olhar para investir
          <span className="rounded-full bg-fill-tertiary px-1.5 py-px text-xs font-medium text-label-secondary">
            Sugestão de IA
          </span>
        </span>
      }
      action={
        <Button onClick={() => void generate()} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> {current ? 'Atualizar' : 'Gerar'}
        </Button>
      }
    >
      <p className="mb-3 rounded-control bg-fill-quaternary px-2.5 py-2 text-xs text-label-secondary">
        Texto gerado por IA a partir de um resumo anônimo da carteira (só classes, totais, taxas e prazos), seguindo as
        classes KRAKEN e as suas metas. É material educativo, não recomendação de investimento: confira antes de
        decidir.
      </p>
      {error && <p className="mb-2 text-sm text-expense">{error}</p>}
      {loading && <p className="text-sm text-label-secondary">Analisando a carteira…</p>}
      {!loading && !current && !error && (
        <p className="text-sm text-label-secondary">Clique em Gerar para receber sugestões sobre a sua carteira.</p>
      )}
      {!loading && current && (
        <>
          <ul className="space-y-2.5">
            {current.insights.map((insight, index) => (
              <li key={index}>
                <div className="flex items-start gap-2">
                  <span
                    className={`mt-px shrink-0 rounded-full px-1.5 text-[11px] font-medium ${PRIORITY_STYLE[insight.priority]}`}
                  >
                    {insight.priority === 'media' ? 'média' : insight.priority}
                  </span>
                  <div>
                    <div className="font-medium">{insight.title}</div>
                    <p className="text-sm text-label-secondary">{insight.detail}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-label-tertiary">
            Gerado por {current.provider} ({current.model}) em {formatDate(current.generatedAt.slice(0, 10))}
          </p>
        </>
      )}
    </Panel>
  )
}

/** Cor fixa por classe (segue a entidade, nunca a posição no ranking). Paleta validada para daltonismo. */
const CLASS_COLOR_TOKEN: Record<KrakenClass, keyof ReturnType<typeof useThemeColors>> = {
  cash: 'series1',
  reits: 'series2',
  br_stocks: 'series3',
  crypto: 'series4',
  intl: 'series5',
  opportunities: 'series6'
}

function ChartTooltip({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-control bg-window-bg px-2.5 py-1.5 text-sm shadow-panel">
      <div className="text-label-secondary">{title}</div>
      <div className="tabular font-semibold">{value}</div>
    </div>
  )
}

/** Rosca com legenda ao lado: nome, % e valor sempre visíveis (a cor nunca é a única pista). */
function ClassDonut({ allocation, totalCents }: { allocation: AllocationSlice[]; totalCents: number }) {
  const colors = useThemeColors()
  const slices = allocation.filter((a) => a.valueCents > 0)
  return (
    <div className="flex items-center gap-4">
      <div className="relative size-[180px] shrink-0" role="img" aria-label="Gráfico de rosca da carteira por classe">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="valueCents"
              nameKey="label"
              innerRadius={58}
              outerRadius={86}
              startAngle={90}
              endAngle={-270}
              stroke={colors.surface}
              strokeWidth={2}
              isAnimationActive={false}
            >
              {slices.map((s) => (
                <Cell key={s.krakenClass} fill={colors[CLASS_COLOR_TOKEN[s.krakenClass]]} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                const s = payload?.[0]?.payload as AllocationSlice | undefined
                return active && s ? (
                  <ChartTooltip
                    title={s.label}
                    value={`${formatMoney(s.valueCents)} · ${formatPercent(s.currentPercent)}`}
                  />
                ) : null
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-label-secondary">Classificado</span>
          <span className="tabular text-sm font-semibold">{formatMoneyCompact(totalCents)}</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {allocation.map((a) => (
          <li key={a.krakenClass} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-sm"
              style={{ background: colors[CLASS_COLOR_TOKEN[a.krakenClass]] }}
            />
            <span className="flex-1 truncate">{a.label}</span>
            <span className="tabular shrink-0 text-right font-medium">{formatPercent(a.currentPercent)}</span>
            <span className="tabular w-[88px] shrink-0 text-right text-label-secondary">{formatMoneyCompact(a.valueCents)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Barras horizontais: ganho em azul, perda em vermelho, valor escrito na ponta. */
function ProfitByClassChart({ stats }: { stats: InvestmentsOverview['stats'] }) {
  const colors = useThemeColors()
  if (stats.profitByClass.length === 0) {
    return <p className="text-sm text-label-secondary">As instituições não informaram rendimento das posições.</p>
  }
  return (
    <div
      style={{ height: stats.profitByClass.length * 36 + 16 }}
      role="img"
      aria-label="Gráfico de rendimento por classe"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={stats.profitByClass} layout="vertical" margin={{ top: 4, right: 88, bottom: 4, left: 0 }}>
          <XAxis type="number" hide domain={['auto', 'auto']} />
          <YAxis
            type="category"
            dataKey="label"
            width={130}
            tickLine={false}
            axisLine={false}
            tick={{ fill: colors.secondaryLabel, fontSize: 12 }}
          />
          <ReferenceLine x={0} stroke={colors.axis} />
          <Tooltip
            cursor={{ fill: colors.grid, opacity: 0.4 }}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as InvestmentsOverview['stats']['profitByClass'][number] | undefined
              return active && p ? <ChartTooltip title={p.label} value={formatMoney(p.profitCents)} /> : null
            }}
          />
          <Bar dataKey="profitCents" radius={4} barSize={18} isAnimationActive={false}>
            {stats.profitByClass.map((p) => (
              <Cell key={p.label} fill={p.profitCents >= 0 ? colors.gain : colors.loss} />
            ))}
            <LabelList
              dataKey="profitCents"
              content={(props) => {
                // Sempre à direita da ponta direita da barra: em valor negativo, é a linha do zero.
                const x = Number(props.x ?? 0)
                const width = Number(props.width ?? 0)
                const y = Number(props.y ?? 0) + Number(props.height ?? 0) / 2
                return (
                  <text
                    x={Math.max(x, x + width) + 6}
                    y={y}
                    dominantBaseline="central"
                    fill={colors.label}
                    fontSize={12}
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {formatMoney(Number(props.value))}
                  </text>
                )
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Escada de vencimentos: liquidez hoje + valor que vence em cada ano. */
function MaturityChart({ stats }: { stats: InvestmentsOverview['stats'] }) {
  const colors = useThemeColors()
  const data = [
    ...(stats.noMaturityCents > 0 ? [{ label: 'Liquidez', valueCents: stats.noMaturityCents }] : []),
    ...stats.maturities.map((m) => ({ label: m.year, valueCents: m.valueCents }))
  ]
  if (data.length === 0) return <p className="text-sm text-label-secondary">Sem dados de vencimento.</p>
  return (
    <div className="h-[200px]" role="img" aria-label="Gráfico de vencimentos por ano">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 4, bottom: 0, left: 4 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke={colors.grid} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: colors.grid }}
            tick={{ fill: colors.axis, fontSize: 11 }}
          />
          <YAxis
            tickFormatter={(v: number) => formatMoneyCompact(v)}
            tickLine={false}
            axisLine={false}
            width={64}
            tick={{ fill: colors.axis, fontSize: 11 }}
          />
          <Tooltip
            cursor={{ fill: colors.grid, opacity: 0.4 }}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as (typeof data)[number] | undefined
              return active && p ? (
                <ChartTooltip
                  title={p.label === 'Liquidez' ? 'Disponível / sem vencimento' : `Vence em ${p.label}`}
                  value={formatMoney(p.valueCents)}
                />
              ) : null
            }}
          />
          <Bar dataKey="valueCents" radius={[4, 4, 0, 0]} fill={colors.primary} isAnimationActive={false}>
            <LabelList
              dataKey="valueCents"
              position="top"
              formatter={(value: unknown) => formatMoneyCompact(Number(value))}
              style={{ fill: colors.secondaryLabel, fontSize: 11 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function HistoryChart({ history }: { history: InvestmentsOverview['history'] }) {
  const colors = useThemeColors()
  const data = history.map((h) => ({ ...h, label: formatDate(h.date).slice(0, 5) }))
  return (
    <div className="h-[200px]" role="img" aria-label="Gráfico da evolução do patrimônio investido">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
          <CartesianGrid vertical={false} stroke={colors.grid} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: colors.grid }}
            tick={{ fill: colors.axis, fontSize: 11 }}
          />
          <YAxis
            tickFormatter={(v: number) => formatMoneyCompact(v)}
            tickLine={false}
            axisLine={false}
            width={64}
            domain={['auto', 'auto']}
            tick={{ fill: colors.axis, fontSize: 11 }}
          />
          <Tooltip
            cursor={{ stroke: colors.axis, strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as (typeof data)[number] | undefined
              if (!active || !point) return null
              return (
                <div className="rounded-control bg-window-bg px-2.5 py-1.5 text-sm shadow-panel">
                  <div className="text-label-secondary">{formatDate(point.date)}</div>
                  <div className="tabular font-semibold">{formatMoney(point.totalCents)}</div>
                </div>
              )
            }}
          />
          <Area
            type="monotone"
            dataKey="totalCents"
            stroke={colors.primary}
            strokeWidth={2}
            fill={colors.primary}
            fillOpacity={0.08}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Posições agrupadas por classe; a classe de cada uma pode ser trocada ali mesmo. */
function Holdings({ investments, onChanged }: { investments: Investment[]; onChanged: () => void }) {
  const groups = useMemo(() => {
    const order: (KrakenClass | null)[] = [...KRAKEN_CLASSES.map((c) => c.key), null]
    return order
      .map((key) => ({
        key,
        label: key ? CLASS_LABEL[key] : 'Sem classe',
        items: investments.filter((i) => i.krakenClass === key).sort((a, b) => b.balanceCents - a.balanceCents)
      }))
      .filter((g) => g.items.length > 0)
  }, [investments])

  async function changeClass(investment: Investment, value: string) {
    await window.api.setInvestmentClass(investment.id, value === AUTO ? null : (value as KrakenClass))
    onChanged()
  }

  return (
    <Panel title="Posições" subtitle="A classe é sugerida pelo tipo do investimento; ajuste quando precisar">
      <table className="w-full text-left">
        <thead className="text-xs text-label-secondary">
          <tr>
            <th className="w-[34%] py-1 font-medium">Investimento</th>
            <th className="px-2 py-1 font-medium">Taxa</th>
            <th className="px-2 py-1 text-right font-medium">12 meses</th>
            <th className="px-2 py-1 font-medium">Vencimento</th>
            <th className="px-2 py-1 text-right font-medium">Rendimento</th>
            <th className="px-2 py-1 text-right font-medium">Saldo</th>
            <th className="py-1 pl-2 font-medium">Classe</th>
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.key ?? 'none'}>
            <tr>
              <th colSpan={7} className="pb-1 pt-3 text-left text-sm font-semibold">
                {group.label}
                <span className="tabular ml-2 font-normal text-label-secondary">
                  {formatMoney(group.items.reduce((s, i) => s + i.balanceCents, 0))}
                </span>
              </th>
            </tr>
            {group.items.map((i) => (
              <tr key={i.id} className="border-t border-[var(--separator)]">
                <td className="max-w-0 py-1.5 pr-2">
                  <div className="truncate" title={i.name}>
                    {i.name}
                  </div>
                  <div className="truncate text-xs text-label-secondary">
                    {i.institution} · {i.subtype ?? i.type}
                  </div>
                </td>
                <td className="whitespace-nowrap px-2 text-sm">
                  {formatContractRate(i.rate, i.rateType, i.fixedAnnualRate) ?? '—'}
                </td>
                <td className="tabular whitespace-nowrap px-2 text-right text-sm">
                  {i.lastTwelveMonthsRate !== null ? formatPercent(i.lastTwelveMonthsRate) : '—'}
                </td>
                <td className="tabular whitespace-nowrap px-2 text-sm text-label-secondary">
                  {i.dueDate ? formatDate(i.dueDate) : '—'}
                </td>
                <td
                  className={`tabular whitespace-nowrap px-2 text-right text-sm ${(i.profitCents ?? 0) > 0 ? 'text-income' : ''}`}
                >
                  {i.profitCents !== null ? formatMoney(i.profitCents) : '—'}
                </td>
                <td className="tabular whitespace-nowrap px-2 text-right font-medium">{formatMoney(i.balanceCents)}</td>
                <td className="py-1.5 pl-2">
                  <Select
                    aria-label={`Classe de ${i.name}`}
                    className="w-40"
                    value={i.krakenClassManual && i.krakenClass ? i.krakenClass : AUTO}
                    onChange={(event) => void changeClass(i, event.target.value)}
                  >
                    {/* A classe automática já aparece no cabeçalho do grupo. */}
                    <option value={AUTO}>Automática</option>
                    {KRAKEN_CLASSES.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </Panel>
  )
}

function TargetsSheet({
  open,
  allocation,
  onClose,
  onSaved
}: {
  open: boolean
  allocation: AllocationSlice[]
  onClose: () => void
  onSaved: () => void
}) {
  const initial = () =>
    Object.fromEntries(allocation.map((a) => [a.krakenClass, String(a.targetPercent)])) as Record<KrakenClass, string>
  const [values, setValues] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setValues(initial())
      setError(null)
    }
  }

  const numbers = Object.fromEntries(
    KRAKEN_CLASSES.map((c) => [c.key, Math.max(0, Math.min(100, Math.round(Number(values[c.key]) || 0)))])
  ) as Record<KrakenClass, number>
  const total = Object.values(numbers).reduce((sum, v) => sum + v, 0)

  async function save() {
    try {
      await window.api.saveAllocationTargets(numbers)
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Metas da alocação KRAKEN">
      <p className="mb-3 text-sm text-label-secondary">
        Preencha o percentual de cada classe conforme o método. A soma precisa dar 100%.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
        className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2"
      >
        {KRAKEN_CLASSES.map((c) => (
          <label key={c.key} className="contents">
            <span>{c.label}</span>
            <span className="flex items-center gap-1">
              <TextField
                type="number"
                min={0}
                max={100}
                className="tabular w-20 text-right"
                value={values[c.key]}
                onChange={(event) => setValues({ ...values, [c.key]: event.target.value })}
              />
              <span className="text-label-secondary">%</span>
            </span>
          </label>
        ))}
        <span className="mt-1 font-semibold">Total</span>
        <span className={`tabular mt-1 pr-4 text-right font-semibold ${total === 100 ? '' : 'text-expense'}`}>
          {total}%
        </span>
        {error && <p className="col-span-2 text-expense">{error}</p>}
        <div className="col-span-2 mt-2 flex justify-end gap-2">
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" type="submit" disabled={total !== 100}>
            Salvar metas
          </Button>
        </div>
      </form>
    </Sheet>
  )
}
