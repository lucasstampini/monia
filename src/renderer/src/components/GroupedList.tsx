import type { ReactNode } from 'react'

// Lista agrupada no estilo dos Ajustes do Sistema: seções arredondadas com linhas separadas.

export function GroupedSection({ title, footer, children }: { title?: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-6">
      {title && <h3 className="mb-1.5 px-2.5 text-sm font-semibold text-label-secondary">{title}</h3>}
      <div className="divide-y divide-[var(--separator)] overflow-hidden rounded-panel bg-control-bg shadow-control">
        {children}
      </div>
      {footer && <p className="mt-1.5 px-2.5 text-sm text-label-secondary">{footer}</p>}
    </section>
  )
}

export function GroupedRow({ label, detail, children }: { label: ReactNode; detail?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex min-h-[38px] items-center justify-between gap-4 px-3 py-1.5">
      <div className="min-w-0">
        <div className="truncate">{label}</div>
        {detail && <div className="truncate text-sm text-label-secondary">{detail}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  )
}
