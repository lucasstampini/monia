import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Wand2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { Category, ReviewGroup } from '@shared/types'
import { Select } from '../components/controls'
import { EmptyState } from '../components/EmptyState'
import { SegmentedControl } from '../components/SegmentedControl'
import { Toolbar } from '../components/Toolbar'
import { formatDate, formatMoney } from '../lib/format'
import { spring } from '../lib/motion'
import { errorMessage, useAsync } from '../lib/useAsync'

type Direction = 'out' | 'in' | 'all'

const DIRECTIONS = [
  { value: 'out' as const, label: 'Saídas' },
  { value: 'in' as const, label: 'Entradas' },
  { value: 'all' as const, label: 'Todas' }
]

/**
 * Fila de revisão: o que nem regra, nem Pluggy, nem IA souberam categorizar.
 * Escolher a categoria de um grupo cria uma regra, então essa descrição nunca mais volta para cá.
 */
export function Review({
  categories,
  dataVersion,
  onDataChanged
}: {
  categories: Category[]
  dataVersion: number
  onDataChanged: () => void
}) {
  const groups = useAsync(() => window.api.listReviewGroups(), [dataVersion])
  const [direction, setDirection] = useState<Direction>('out')
  const [done, setDone] = useState<Set<string>>(new Set())
  const [notice, setNotice] = useState<string | null>(null)

  const visible = useMemo(
    () =>
      (groups.data ?? []).filter(
        (g) =>
          !done.has(g.descriptionNorm) &&
          (direction === 'all' || (direction === 'out' ? g.totalCents < 0 : g.totalCents > 0))
      ),
    [groups.data, done, direction]
  )
  const pendingTotal = visible.reduce((sum, g) => sum + g.totalCents, 0)

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(timer)
  }, [notice])

  async function choose(group: ReviewGroup, categoryId: number) {
    try {
      const { affected } = await window.api.categorizeGroup(group.descriptionNorm, categoryId)
      // Some da lista na hora; a recarga completa vem com o onDataChanged.
      setDone((previous) => new Set(previous).add(group.descriptionNorm))
      const name = categories.find((c) => c.id === categoryId)?.name
      setNotice(`${group.sampleDescription} → ${name} (${affected} transaç${affected === 1 ? 'ão' : 'ões'}, regra criada)`)
      onDataChanged()
    } catch (error) {
      setNotice(errorMessage(error))
    }
  }

  return (
    <>
      <Toolbar
        title="Revisar"
        subtitle={groups.data ? `${visible.length} descrições sem categoria · ${formatMoney(pendingTotal)}` : undefined}
      >
        <SegmentedControl ariaLabel="Tipo" options={DIRECTIONS} value={direction} onChange={setDirection} />
      </Toolbar>

      <div className="flex-1 overflow-y-auto bg-grouped-bg p-5">
        <div className="mx-auto max-w-[820px]">
          {groups.error && <p className="mb-4 text-expense">{groups.error}</p>}
          {groups.data && visible.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Tudo categorizado"
              message="Nada pendente aqui. Novas descrições aparecem depois de cada sincronização."
            />
          ) : (
            <>
              <p className="mb-3 px-1 text-sm text-label-secondary">
                Ordenado pelo valor total. Ao escolher, todas as transações com essa descrição recebem a categoria e o
                app cria uma regra para as próximas. Pix para pessoas cai aqui de propósito: só você sabe o que foi.
              </p>
              <ul className="divide-y divide-[var(--separator)] overflow-hidden rounded-panel bg-control-bg shadow-[var(--shadow-control)]">
                <AnimatePresence initial={false}>
                  {visible.map((group) => (
                    <motion.li
                      key={group.descriptionNorm}
                      layout
                      exit={{ opacity: 0, height: 0 }}
                      transition={spring}
                      className="flex items-center gap-4 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium" title={group.sampleDescription}>
                          {group.sampleDescription}
                        </div>
                        <div className="truncate text-sm text-label-secondary">
                          {group.count} transaç{group.count === 1 ? 'ão' : 'ões'} · última {formatDate(group.lastDate)} ·{' '}
                          {group.accountNames}
                        </div>
                      </div>
                      <span className={`tabular shrink-0 ${group.totalCents > 0 ? 'text-income' : ''}`}>
                        {formatMoney(group.totalCents)}
                      </span>
                      <Select
                        aria-label={`Categoria para ${group.sampleDescription}`}
                        className="w-48 shrink-0"
                        value=""
                        onChange={(event) => void choose(group, Number(event.target.value))}
                      >
                        <option value="" disabled>
                          Escolher categoria…
                        </option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </Select>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {notice && (
          <motion.div
            role="status"
            className="absolute bottom-4 left-1/2 z-20 flex max-w-[80%] -translate-x-1/2 items-center gap-2 rounded-panel bg-window-bg px-3 py-2 shadow-[var(--shadow-panel)]"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={spring}
          >
            <Wand2 size={14} className="shrink-0 text-accent" />
            <span className="truncate">{notice}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
