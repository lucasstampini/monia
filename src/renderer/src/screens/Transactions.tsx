import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Inbox,
  Landmark,
  PanelRight,
  Search,
  SlidersHorizontal,
  Sparkles,
  Wand2,
  X
} from 'lucide-react'
import { useEffect, useMemo, useState, type RefObject } from 'react'
import type { Account, Category, Transaction, TransactionFilter } from '@shared/types'
import { CategoryLabel } from '../components/CategoryLabel'
import { Button, IconButton, Select, TextField } from '../components/controls'
import { EmptyState } from '../components/EmptyState'
import { Popover } from '../components/Popover'
import { Toolbar } from '../components/Toolbar'
import { formatDate, formatMoney, formatMonthLong, formatMonthTitle } from '../lib/format'
import { softSpring, spring } from '../lib/motion'
import { errorMessage, useAsync } from '../lib/useAsync'

type SortKey = 'date' | 'description' | 'category' | 'amount'
type Sort = { key: SortKey; ascending: boolean }

const UNCATEGORIZED = 'none'

type GroupBy = 'statement' | 'purchase'
const GROUP_BY_KEY = 'transactions.groupBy'

/**
 * Mês do agrupamento:
 * - statement: competência (fatura no cartão, data na conta), igual ao Painel;
 * - purchase: mês da data da compra.
 */
function groupMonth(row: Transaction, groupBy: GroupBy): string {
  return groupBy === 'statement' && row.statementMonth ? row.statementMonth : row.date.slice(0, 7)
}

/** Preferência de visualização local (some sem problema se o storage falhar). */
function loadGroupBy(): GroupBy {
  try {
    return localStorage.getItem(GROUP_BY_KEY) === 'purchase' ? 'purchase' : 'statement'
  } catch {
    return 'statement'
  }
}

function compare(a: Transaction, b: Transaction, key: SortKey, categoryName: (id: number | null) => string): number {
  switch (key) {
    case 'date':
      return a.date.localeCompare(b.date) || a.id - b.id
    case 'description':
      return a.descriptionRaw.localeCompare(b.descriptionRaw, 'pt-BR')
    case 'category':
      return categoryName(a.categoryId).localeCompare(categoryName(b.categoryId), 'pt-BR')
    case 'amount':
      return a.amountCents - b.amountCents
  }
}

function Amount({ cents, className = '' }: { cents: number; className?: string }) {
  return (
    <span className={`tabular ${cents > 0 ? 'text-income' : ''} ${className}`}>
      {cents > 0 ? '+' : ''}
      {formatMoney(cents)}
    </span>
  )
}

function sourceLabel(source: Transaction['categorySource']) {
  switch (source) {
    case 'rule':
      return { icon: Wand2, text: 'Regra' }
    case 'source':
      return { icon: Landmark, text: 'Categoria da Pluggy' }
    case 'ai':
      return { icon: Sparkles, text: 'IA' }
    case 'manual':
      return { icon: null, text: 'Manual' }
    default:
      return null
  }
}

export function Transactions({
  accounts,
  categories,
  accountId,
  dataVersion,
  onDataChanged,
  searchRef,
  onSync
}: {
  accounts: Account[]
  categories: Category[]
  accountId?: number
  dataVersion: number
  onDataChanged: () => void
  searchRef: RefObject<HTMLInputElement | null>
  onSync: () => void
}) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [month, setMonth] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [sort, setSort] = useState<Sort>({ key: 'date', ascending: false })
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const [groupBy, setGroupByState] = useState<GroupBy>(loadGroupBy)
  const setGroupBy = (value: GroupBy) => {
    setGroupByState(value)
    try {
      localStorage.setItem(GROUP_BY_KEY, value)
    } catch {
      // preferência só desta sessão
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 150)
    return () => clearTimeout(timer)
  }, [search])

  const filter: TransactionFilter = {
    search: debouncedSearch || undefined,
    accountId,
    month: month || undefined,
    categoryId: categoryFilter === '' ? undefined : categoryFilter === UNCATEGORIZED ? null : Number(categoryFilter)
  }
  const months = useAsync(() => window.api.listMonths(), [dataVersion])
  const list = useAsync(
    () => window.api.listTransactions(filter),
    [dataVersion, debouncedSearch, accountId, month, categoryFilter]
  )

  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const categoryName = (id: number | null) => (id === null ? 'Sem categoria' : (categoriesById.get(id)?.name ?? ''))

  const rows = useMemo(() => {
    const sorted = [...(list.data ?? [])].sort((a, b) => compare(a, b, sort.key, categoryName))
    return sort.ascending ? sorted : sorted.reverse()
    // categoryName depende só de categoriesById
  }, [list.data, sort, categoriesById])

  // Divide por mês de competência (fatura no cartão, data na conta), como no Painel.
  // A ordem dos meses segue a ordenação por data; dentro do mês vale a coluna escolhida.
  const monthGroups = useMemo(() => {
    const groups = new Map<string, { month: string; rows: Transaction[]; outCents: number; inCents: number }>()
    for (const row of rows) {
      const month = groupMonth(row, groupBy)
      const group = groups.get(month) ?? { month, rows: [], outCents: 0, inCents: 0 }
      group.rows.push(row)
      if (row.amountCents < 0) group.outCents += row.amountCents
      else group.inCents += row.amountCents
      groups.set(month, group)
    }
    const ascending = sort.key === 'date' && sort.ascending
    return [...groups.values()].sort((a, b) =>
      ascending ? a.month.localeCompare(b.month) : b.month.localeCompare(a.month)
    )
  }, [rows, sort, groupBy])

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const toggleMonth = (month: string) =>
    setCollapsed((previous) => {
      const next = new Set(previous)
      if (next.has(month)) next.delete(month)
      else next.add(month)
      return next
    })
  /** Linhas na ordem em que aparecem na tela (para navegar com as setas). */
  const visibleRows = useMemo(
    () => monthGroups.filter((g) => !collapsed.has(g.month)).flatMap((g) => g.rows),
    [monthGroups, collapsed]
  )
  const columnCount = accountId ? 4 : 5

  const selected = rows.find((row) => row.id === selectedId) ?? null
  const total = rows.reduce((sum, row) => sum + row.amountCents, 0)
  const account = accounts.find((a) => a.id === accountId)
  const activeFilters = Number(Boolean(month)) + Number(Boolean(categoryFilter))

  // Setas para cima/baixo mudam a seleção, como na list view do Finder.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
      if ((event.target as HTMLElement).closest('input, select, textarea')) return
      event.preventDefault()
      const index = visibleRows.findIndex((row) => row.id === selectedId)
      const next =
        visibleRows[Math.max(0, Math.min(visibleRows.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))]
      if (next) {
        setSelectedId(next.id)
        document.getElementById(`tx-${next.id}`)?.scrollIntoView({ block: 'nearest' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visibleRows, selectedId])

  async function recategorize(transaction: Transaction, value: string) {
    const categoryId = value === UNCATEGORIZED ? null : Number(value)
    try {
      const { affected } = await window.api.updateTransactionCategory(transaction.id, categoryId)
      setNotice(
        categoryId === null
          ? 'Categoria removida.'
          : `Aprendido: "${transaction.descriptionNorm}" → ${categoryName(categoryId)}` +
              (affected > 1 ? ` (${affected} transações atualizadas)` : '')
      )
      onDataChanged()
    } catch (error) {
      setNotice(errorMessage(error))
    }
  }

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(timer)
  }, [notice])

  const header = (key: SortKey, label: string, align: 'left' | 'right' = 'left') => {
    const active = sort.key === key
    const Icon = sort.ascending ? ChevronUp : ChevronDown
    return (
      <th
        scope="col"
        aria-sort={active ? (sort.ascending ? 'ascending' : 'descending') : 'none'}
        className={`sticky top-0 z-10 border-b border-[var(--separator)] bg-content-bg px-3 py-1 font-medium text-label-secondary ${align === 'right' ? 'text-right' : 'text-left'}`}
      >
        <button
          type="button"
          onClick={() => setSort({ key, ascending: active ? !sort.ascending : key !== 'date' && key !== 'amount' })}
          className={`inline-flex items-center gap-0.5 ${align === 'right' ? 'flex-row-reverse' : ''} ${active ? 'text-label' : ''}`}
        >
          {label}
          <Icon size={12} className={active ? 'opacity-100' : 'opacity-0'} />
        </button>
      </th>
    )
  }

  const empty = !list.loading && rows.length === 0
  const noData = empty && !debouncedSearch && !month && !categoryFilter && !accountId

  return (
    <>
      <Toolbar
        title={account ? account.name : 'Transações'}
        subtitle={list.data ? `${rows.length} transações · saldo ${formatMoney(total)}` : undefined}
      >
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute left-2 top-[5px] text-label-tertiary" />
          <TextField
            ref={searchRef}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => event.key === 'Escape' && setSearch('')}
            placeholder="Buscar"
            aria-label="Buscar transações"
            className="w-52 pl-7"
          />
        </div>
        <Popover
          trigger={({ toggle, open }) => (
            <IconButton
              onClick={toggle}
              aria-label="Filtros"
              aria-expanded={open}
              className={activeFilters ? 'text-accent' : ''}
            >
              <SlidersHorizontal size={16} strokeWidth={1.5} />
              {activeFilters > 0 && <span className="text-xs font-semibold">{activeFilters}</span>}
            </IconButton>
          )}
        >
          <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
            <label htmlFor="group-by" className="text-label-secondary">
              Agrupar por
            </label>
            <Select id="group-by" value={groupBy} onChange={(event) => setGroupBy(event.target.value as GroupBy)}>
              <option value="statement">Mês da fatura</option>
              <option value="purchase">Mês da compra</option>
            </Select>
            <label htmlFor="filter-month" className="text-label-secondary">
              Competência
            </label>
            <Select id="filter-month" value={month} onChange={(event) => setMonth(event.target.value)}>
              <option value="">Todos os meses</option>
              {(months.data ?? []).map((m) => (
                <option key={m} value={m}>
                  {formatMonthLong(m)}
                </option>
              ))}
            </Select>
            <label htmlFor="filter-category" className="text-label-secondary">
              Categoria
            </label>
            <Select
              id="filter-category"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="">Todas</option>
              <option value={UNCATEGORIZED}>Sem categoria</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          {activeFilters > 0 && (
            <div className="mt-3 flex justify-end">
              <Button
                variant="plain"
                onClick={() => {
                  setMonth('')
                  setCategoryFilter('')
                }}
              >
                Limpar filtros
              </Button>
            </div>
          )}
        </Popover>
        <IconButton
          onClick={() => setInspectorOpen((v) => !v)}
          aria-label={inspectorOpen ? 'Ocultar inspetor' : 'Mostrar inspetor'}
          aria-pressed={inspectorOpen}
        >
          <PanelRight size={16} strokeWidth={1.5} />
        </IconButton>
      </Toolbar>

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-auto">
          {list.error && <p className="p-4 text-expense">{list.error}</p>}
          {noData ? (
            <EmptyState
              icon={Inbox}
              title="Nenhuma transação ainda"
              message="Conecte suas contas pelo Meu Pluggy e sincronize para ver seus gastos aqui."
              action={
                <Button variant="primary" onClick={onSync}>
                  Sincronizar
                </Button>
              }
            />
          ) : empty ? (
            <EmptyState
              icon={Search}
              title="Nada encontrado"
              message="Nenhuma transação corresponde à busca e aos filtros."
            />
          ) : (
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  {header('date', 'Data')}
                  {header('description', 'Descrição')}
                  {header('category', 'Categoria')}
                  {!accountId && (
                    <th
                      scope="col"
                      className="sticky top-0 z-10 border-b border-[var(--separator)] bg-content-bg px-3 py-1 text-left font-medium text-label-secondary"
                    >
                      Conta
                    </th>
                  )}
                  {header('amount', 'Valor', 'right')}
                </tr>
              </thead>
              {monthGroups.map((group) => {
                const isCollapsed = collapsed.has(group.month)
                return (
                  <tbody key={group.month}>
                    <tr>
                      <th
                        scope="rowgroup"
                        colSpan={columnCount}
                        className="sticky top-[25px] z-[5] border-b border-[var(--separator)] bg-window-bg/95 px-0 text-left font-normal backdrop-blur"
                      >
                        <button
                          type="button"
                          onClick={() => toggleMonth(group.month)}
                          aria-expanded={!isCollapsed}
                          className="flex h-8 w-full items-center gap-2 px-3"
                        >
                          <ChevronRight
                            size={13}
                            className={`shrink-0 text-label-secondary transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                          />
                          <span className="font-semibold">{formatMonthTitle(group.month)}</span>
                          <span className="text-sm text-label-secondary">
                            {group.rows.length} transaç{group.rows.length === 1 ? 'ão' : 'ões'}
                          </span>
                          <span className="tabular ml-auto flex items-baseline gap-3 text-sm">
                            <span className="text-label-secondary">saídas {formatMoney(group.outCents)}</span>
                            <span className="text-label-secondary">entradas {formatMoney(group.inCents)}</span>
                            <span className="font-semibold">saldo {formatMoney(group.outCents + group.inCents)}</span>
                          </span>
                        </button>
                      </th>
                    </tr>
                    {!isCollapsed &&
                      group.rows.map((row, index) => {
                        const isSelected = row.id === selectedId
                        return (
                          <tr
                            key={row.id}
                            id={`tx-${row.id}`}
                            onClick={() => setSelectedId(row.id)}
                            aria-selected={isSelected}
                            className={`h-6 ${isSelected ? 'bg-accent text-white [&_*]:!text-white' : index % 2 ? 'bg-row-alt' : ''}`}
                          >
                            <td className="tabular whitespace-nowrap px-3 text-label-secondary">
                              {formatDate(row.date)}
                            </td>
                            <td className="max-w-0 w-1/2 px-3">
                              <span className="block truncate" title={row.descriptionRaw}>
                                {row.descriptionRaw}
                                {row.installmentTotal && (
                                  <span className="tabular ml-1.5 text-label-secondary">
                                    {row.installmentCurrent}/{row.installmentTotal}
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="px-1.5">
                              <CategoryPicker
                                value={row.categoryId}
                                categories={categories}
                                categoriesById={categoriesById}
                                onChange={(value) => void recategorize(row, value)}
                              />
                            </td>
                            {!accountId && (
                              <td className="max-w-[160px] truncate px-3 text-label-secondary">{row.accountName}</td>
                            )}
                            <td className="whitespace-nowrap px-3 text-right">
                              <Amount cents={row.amountCents} />
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                )
              })}
            </table>
          )}
        </div>

        <AnimatePresence initial={false}>
          {inspectorOpen && (
            <motion.aside
              aria-label="Detalhes da transação"
              className="shrink-0 overflow-hidden border-l border-[var(--separator)] bg-window-bg"
              initial={{ width: 0 }}
              animate={{ width: 280 }}
              exit={{ width: 0 }}
              transition={softSpring}
            >
              <div className="w-[280px] p-4">
                {selected ? (
                  <Inspector
                    transaction={selected}
                    categories={categories}
                    onChange={(value) => void recategorize(selected, value)}
                  />
                ) : (
                  <p className="pt-8 text-center text-label-secondary">Selecione uma transação</p>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {notice && (
          <motion.div
            role="status"
            className="pointer-events-auto absolute bottom-4 left-1/2 z-20 flex max-w-[80%] -translate-x-1/2 items-center gap-2 rounded-panel bg-window-bg px-3 py-2 shadow-[var(--shadow-panel)]"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={spring}
          >
            <Wand2 size={14} className="shrink-0 text-accent" />
            <span className="truncate">{notice}</span>
            <IconButton onClick={() => setNotice(null)} aria-label="Fechar aviso" className="h-5 min-w-5">
              <X size={12} />
            </IconButton>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

/** Select nativo disfarçado de rótulo: mostra a categoria e vira menu ao clicar. */
function CategoryPicker({
  value,
  categories,
  categoriesById,
  onChange
}: {
  value: number | null
  categories: Category[]
  categoriesById: Map<number, Category>
  onChange: (value: string) => void
}) {
  return (
    <label className="relative flex h-5 max-w-[200px] items-center rounded-[5px] px-1.5 hover:bg-fill-quaternary">
      <CategoryLabel category={value === null ? undefined : categoriesById.get(value)} />
      <select
        aria-label="Categoria"
        value={value ?? UNCATEGORIZED}
        onChange={(event) => onChange(event.target.value)}
        onClick={(event) => event.stopPropagation()}
        className="absolute inset-0 cursor-default appearance-none opacity-0"
      >
        <option value={UNCATEGORIZED}>Sem categoria</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  )
}

function Inspector({
  transaction,
  categories,
  onChange
}: {
  transaction: Transaction
  categories: Category[]
  onChange: (value: string) => void
}) {
  const source = sourceLabel(transaction.categorySource)
  const rows: [string, string][] = [
    ['Data da compra', formatDate(transaction.date)],
    [
      'Competência',
      transaction.statementMonth
        ? `Fatura de ${formatMonthLong(transaction.statementMonth)}`
        : formatMonthLong(transaction.date.slice(0, 7))
    ],
    ['Conta', transaction.accountName]
  ]
  if (transaction.installmentTotal) {
    rows.push(['Parcela', `${transaction.installmentCurrent} de ${transaction.installmentTotal}`])
  }

  return (
    <div>
      <p className="mb-1 select-text break-words font-semibold">{transaction.descriptionRaw}</p>
      <Amount cents={transaction.amountCents} className="text-[22px] font-semibold leading-7" />

      <dl className="mt-4 divide-y divide-[var(--separator)] rounded-panel bg-control-bg px-3 shadow-[var(--shadow-control)]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 py-1.5">
            <dt className="text-label-secondary">{label}</dt>
            <dd className="tabular truncate text-right">{value}</dd>
          </div>
        ))}
      </dl>

      <label htmlFor="inspector-category" className="mb-1 mt-4 block text-sm font-semibold text-label-secondary">
        Categoria
      </label>
      <Select
        id="inspector-category"
        className="w-full"
        value={transaction.categoryId ?? UNCATEGORIZED}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value={UNCATEGORIZED}>Sem categoria</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      {source && (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-label-secondary">
          {source.icon && <source.icon size={11} />}
          Definida por: {source.text}
        </p>
      )}
      <p className="mt-3 text-xs text-label-secondary">
        Ao corrigir, o app cria uma regra para “{transaction.descriptionNorm}” e aplica às transações iguais.
      </p>
    </div>
  )
}
