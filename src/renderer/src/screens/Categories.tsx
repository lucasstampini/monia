import { Check, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { Category, CategoryInput } from '@shared/types'
import { CategoryLabel } from '../components/CategoryLabel'
import { Button, IconButton, Select, Switch, TextField } from '../components/controls'
import { GroupedRow, GroupedSection } from '../components/GroupedList'
import { Sheet } from '../components/Sheet'
import { Toolbar } from '../components/Toolbar'
import { errorMessage, useAsync } from '../lib/useAsync'

/** Paleta de cores do sistema da Apple para as categorias (dados, não estilo de componente). */
const SWATCHES = [
  '#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#00C7BE', '#30B0C7',
  '#32ADE6', '#007AFF', '#5856D6', '#AF52DE', '#FF2D55', '#A2845E', '#8E8E93', '#636366'
]

export function Categories({
  categories,
  dataVersion,
  onDataChanged
}: {
  categories: Category[]
  dataVersion: number
  onDataChanged: () => void
}) {
  const usage = useAsync(() => window.api.listCategoryUsage(), [dataVersion])
  const [editing, setEditing] = useState<CategoryInput | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)
  const usageOf = (id: number) => usage.data?.find((u) => u.categoryId === id)

  const spending = categories.filter((c) => !c.excludedFromSpending)
  const nonSpending = categories.filter((c) => c.excludedFromSpending)

  const renderRow = (category: Category) => {
    const used = usageOf(category.id)
    return (
      <GroupedRow
        key={category.id}
        label={<CategoryLabel category={category} />}
        detail={
          used
            ? `${used.transactions} transações · ${used.rules} regras${category.essential ? ' · essencial' : ''}`
            : undefined
        }
      >
        <Button variant="plain" onClick={() => setEditing({ ...category })}>
          Editar
        </Button>
        <IconButton aria-label={`Excluir categoria ${category.name}`} onClick={() => setDeleting(category)}>
          <Trash2 size={14} strokeWidth={1.5} />
        </IconButton>
      </GroupedRow>
    )
  }

  return (
    <>
      <Toolbar title="Categorias" subtitle={`${categories.length} categorias`}>
        <Button onClick={() => setEditing({ name: '', color: SWATCHES[7]!, excludedFromSpending: false, essential: false })}>
          <Plus size={14} /> Nova categoria
        </Button>
      </Toolbar>

      <div className="flex-1 overflow-y-auto bg-grouped-bg p-5">
        <div className="mx-auto max-w-[640px]">
          <GroupedSection title="Gastos e entradas">{spending.map(renderRow)}</GroupedSection>
          <GroupedSection
            title="Não contam como gasto"
            footer="Movimentações que não são consumo, como pagar a fatura, investir ou mover dinheiro entre suas contas. Ficam fora do Painel para não contar em dobro."
          >
            {nonSpending.map(renderRow)}
            {nonSpending.length === 0 && <GroupedRow label={<span className="text-label-secondary">Nenhuma</span>} />}
          </GroupedSection>
        </div>
      </div>

      <CategorySheet
        category={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          onDataChanged()
        }}
      />
      <DeleteSheet
        category={deleting}
        categories={categories}
        usage={deleting ? usageOf(deleting.id) : undefined}
        onClose={() => setDeleting(null)}
        onDeleted={() => {
          setDeleting(null)
          onDataChanged()
        }}
      />
    </>
  )
}

function CategorySheet({
  category,
  onClose,
  onSaved
}: {
  category: CategoryInput | null
  onClose: () => void
  onSaved: () => void
}) {
  const [draft, setDraft] = useState<CategoryInput | null>(category)
  const [error, setError] = useState<string | null>(null)
  const [last, setLast] = useState(category)
  if (category !== last) {
    setLast(category)
    setDraft(category)
    setError(null)
  }

  async function save() {
    if (!draft) return
    try {
      await window.api.saveCategory(draft)
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Sheet open={category !== null} onClose={onClose} title={category?.id ? 'Editar categoria' : 'Nova categoria'}>
      {draft && (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
          className="grid grid-cols-[120px_1fr] items-center gap-x-3 gap-y-3"
        >
          <label htmlFor="category-name" className="text-right text-label-secondary">
            Nome
          </label>
          <TextField
            id="category-name"
            autoFocus
            value={draft.name}
            maxLength={60}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />

          <span className="self-start pt-1 text-right text-label-secondary">Cor</span>
          <div role="radiogroup" aria-label="Cor" className="flex flex-wrap gap-2">
            {SWATCHES.map((color) => (
              <button
                key={color}
                type="button"
                role="radio"
                aria-checked={draft.color.toUpperCase() === color}
                aria-label={color}
                onClick={() => setDraft({ ...draft, color })}
                className="flex size-6 items-center justify-center rounded-full shadow-[var(--shadow-control)]"
                style={{ background: color }}
              >
                {draft.color.toUpperCase() === color && <Check size={13} strokeWidth={3} className="text-white" />}
              </button>
            ))}
          </div>

          <span className="text-right text-label-secondary">Conta como gasto</span>
          <div className="flex items-center gap-2">
            <Switch
              label="Conta como gasto"
              checked={!draft.excludedFromSpending}
              onChange={(checked) => setDraft({ ...draft, excludedFromSpending: !checked })}
            />
            <span className="text-sm text-label-secondary">
              {draft.excludedFromSpending ? 'Fica fora do Painel' : 'Aparece no Painel'}
            </span>
          </div>

          <span className="text-right text-label-secondary">Essencial</span>
          <div className="flex items-center gap-2">
            <Switch
              label="Essencial"
              checked={draft.essential}
              onChange={(checked) => setDraft({ ...draft, essential: checked })}
            />
            <span className="text-sm text-label-secondary">
              {draft.essential ? 'Sem sugestões de corte' : 'Pode receber sugestões de economia'}
            </span>
          </div>

          {error && <p className="col-span-2 text-expense">{error}</p>}
          <div className="col-span-2 mt-1 flex justify-end gap-2">
            <Button onClick={onClose}>Cancelar</Button>
            <Button variant="primary" type="submit" disabled={!draft.name.trim()}>
              Salvar
            </Button>
          </div>
        </form>
      )}
    </Sheet>
  )
}

const NO_CATEGORY = 'none'

function DeleteSheet({
  category,
  categories,
  usage,
  onClose,
  onDeleted
}: {
  category: Category | null
  categories: Category[]
  usage: { transactions: number; rules: number } | undefined
  onClose: () => void
  onDeleted: () => void
}) {
  const [replacement, setReplacement] = useState(NO_CATEGORY)
  const [error, setError] = useState<string | null>(null)
  const [last, setLast] = useState(category)
  if (category !== last) {
    setLast(category)
    setReplacement(NO_CATEGORY)
    setError(null)
  }

  async function confirm() {
    if (!category) return
    try {
      await window.api.deleteCategory(category.id, replacement === NO_CATEGORY ? null : Number(replacement))
      onDeleted()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const inUse = (usage?.transactions ?? 0) + (usage?.rules ?? 0) > 0

  return (
    <Sheet open={category !== null} onClose={onClose} title={`Excluir “${category?.name ?? ''}”?`}>
      {category && (
        <>
          {inUse ? (
            <>
              <p className="mb-3">
                {usage?.transactions ?? 0} transações e {usage?.rules ?? 0} regras usam esta categoria. Para onde elas
                vão?
              </p>
              <Select className="mb-2 w-full" value={replacement} onChange={(event) => setReplacement(event.target.value)}>
                <option value={NO_CATEGORY}>Sem categoria (transações vão para Revisar, regras são apagadas)</option>
                {categories
                  .filter((c) => c.id !== category.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      Mover para {c.name}
                    </option>
                  ))}
              </Select>
            </>
          ) : (
            <p className="mb-3 text-label-secondary">Nenhuma transação ou regra usa esta categoria.</p>
          )}
          <p className="mb-4 text-sm text-label-secondary">Esta ação não pode ser desfeita.</p>
          {error && <p className="mb-3 text-expense">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button onClick={onClose} autoFocus>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => void confirm()}>
              Excluir
            </Button>
          </div>
        </>
      )}
    </Sheet>
  )
}
