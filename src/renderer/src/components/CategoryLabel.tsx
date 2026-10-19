import type { Category } from '@shared/types'

/** Ponto colorido + nome. A cor nunca carrega sentido sozinha: o nome está sempre junto. */
export function CategoryLabel({ category }: { category: Category | undefined }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full"
        style={{ background: category?.color ?? 'var(--tertiary-label)' }}
      />
      <span className={`truncate ${category ? '' : 'text-label-secondary'}`}>{category?.name ?? 'Sem categoria'}</span>
    </span>
  )
}
