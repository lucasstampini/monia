import { AnimatePresence, motion } from 'framer-motion'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { Category, MatchType, Rule, RuleInput } from '@shared/types'
import { CategoryLabel } from '../components/CategoryLabel'
import { Button, IconButton, Select, TextField } from '../components/controls'
import { GroupedRow, GroupedSection } from '../components/GroupedList'
import { Sheet } from '../components/Sheet'
import { Toolbar } from '../components/Toolbar'
import { spring } from '../lib/motion'
import { errorMessage, useAsync } from '../lib/useAsync'

const MATCH_LABELS: Record<MatchType, string> = {
  contains: 'contém',
  exact: 'é exatamente',
  regex: 'casa com a regex'
}

export function Rules({ categories, onDataChanged }: { categories: Category[]; onDataChanged: () => void }) {
  const rules = useAsync(() => window.api.listRules(), [])
  const [editing, setEditing] = useState<RuleInput | null>(null)
  const byId = new Map(categories.map((c) => [c.id, c]))

  const manual = (rules.data ?? []).filter((r) => r.origin === 'manual')
  const learned = (rules.data ?? []).filter((r) => r.origin === 'correction')

  async function remove(rule: Rule) {
    await window.api.deleteRule(rule.id)
    rules.reload()
    onDataChanged()
  }

  const renderRule = (rule: Rule) => (
    <motion.div key={rule.id} layout transition={spring}>
      <GroupedRow
        label={
          <span>
            <span className="text-label-secondary">Descrição {MATCH_LABELS[rule.matchType]} </span>
            <span className="font-medium">“{rule.pattern}”</span>
          </span>
        }
        detail={`Prioridade ${rule.priority}`}
      >
        <CategoryLabel category={byId.get(rule.categoryId)} />
        <Button variant="plain" onClick={() => setEditing({ ...rule })}>
          Editar
        </Button>
        <IconButton aria-label={`Apagar regra ${rule.pattern}`} onClick={() => void remove(rule)}>
          <Trash2 size={14} strokeWidth={1.5} />
        </IconButton>
      </GroupedRow>
    </motion.div>
  )

  return (
    <>
      <Toolbar title="Regras" subtitle="Avaliadas da maior para a menor prioridade; a primeira que casar vence">
        <Button
          onClick={() => setEditing({ pattern: '', matchType: 'contains', categoryId: categories[0]?.id ?? 0, priority: 0 })}
        >
          <Plus size={14} /> Nova regra
        </Button>
      </Toolbar>
      <div className="flex-1 overflow-y-auto bg-grouped-bg p-5">
        <div className="mx-auto max-w-[720px]">
          {rules.error && <p className="mb-4 text-expense">{rules.error}</p>}
          <GroupedSection title="Suas regras" footer="Regras rodam antes da IA. Salvar ou apagar uma regra reaplica tudo (exceto categorias manuais).">
            <AnimatePresence initial={false}>{manual.map(renderRule)}</AnimatePresence>
            {manual.length === 0 && <GroupedRow label={<span className="text-label-secondary">Nenhuma regra</span>} />}
          </GroupedSection>
          <GroupedSection title="Aprendidas com suas correções" footer="Criadas automaticamente quando você muda a categoria de uma transação.">
            <AnimatePresence initial={false}>{learned.map(renderRule)}</AnimatePresence>
            {learned.length === 0 && <GroupedRow label={<span className="text-label-secondary">Nenhuma correção ainda</span>} />}
          </GroupedSection>
        </div>
      </div>

      <RuleSheet
        rule={editing}
        categories={categories}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          rules.reload()
          onDataChanged()
        }}
      />
    </>
  )
}

function RuleSheet({
  rule,
  categories,
  onClose,
  onSaved
}: {
  rule: RuleInput | null
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}) {
  const [draft, setDraft] = useState<RuleInput | null>(rule)
  const [error, setError] = useState<string | null>(null)
  const [lastRule, setLastRule] = useState(rule)

  // Reinicia o rascunho quando outra regra é aberta.
  if (rule !== lastRule) {
    setLastRule(rule)
    setDraft(rule)
    setError(null)
  }

  async function save() {
    if (!draft) return
    if (draft.matchType === 'regex') {
      try {
        new RegExp(draft.pattern)
      } catch {
        setError('Expressão regular inválida.')
        return
      }
    }
    try {
      await window.api.saveRule(draft)
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Sheet open={rule !== null} onClose={onClose} title={rule?.id ? 'Editar regra' : 'Nova regra'}>
      {draft && (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
          className="grid grid-cols-[110px_1fr] items-center gap-x-3 gap-y-2.5"
        >
          <label className="text-right text-label-secondary" htmlFor="rule-match">
            Descrição
          </label>
          <Select
            id="rule-match"
            value={draft.matchType}
            onChange={(event) => setDraft({ ...draft, matchType: event.target.value as MatchType })}
          >
            {Object.entries(MATCH_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <label className="text-right text-label-secondary" htmlFor="rule-pattern">
            Texto
          </label>
          <TextField
            id="rule-pattern"
            autoFocus
            value={draft.pattern}
            placeholder={draft.matchType === 'regex' ? '^POSTO\\s' : 'IFOOD'}
            onChange={(event) => setDraft({ ...draft, pattern: event.target.value })}
          />
          <label className="text-right text-label-secondary" htmlFor="rule-category">
            Categoria
          </label>
          <Select
            id="rule-category"
            value={draft.categoryId}
            onChange={(event) => setDraft({ ...draft, categoryId: Number(event.target.value) })}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <label className="text-right text-label-secondary" htmlFor="rule-priority">
            Prioridade
          </label>
          <TextField
            id="rule-priority"
            type="number"
            className="w-24"
            value={draft.priority}
            onChange={(event) => setDraft({ ...draft, priority: Number(event.target.value) || 0 })}
          />
          {error && <p className="col-span-2 text-expense">{error}</p>}
          <div className="col-span-2 mt-2 flex justify-end gap-2">
            <Button onClick={onClose}>Cancelar</Button>
            <Button variant="primary" type="submit" disabled={!draft.pattern.trim()}>
              Salvar
            </Button>
          </div>
        </form>
      )}
    </Sheet>
  )
}
