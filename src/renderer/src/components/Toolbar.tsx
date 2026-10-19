import type { ReactNode } from 'react'

/**
 * Toolbar unificada: é a área de arrasto da janela.
 * Controles dentro dela usam `no-drag` (já embutido nos componentes de controle).
 * No Windows, reserva espaço à direita para os botões nativos da janela.
 */
export function Toolbar({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <header className="drag flex h-[52px] shrink-0 items-center gap-3 border-b border-[var(--separator)] bg-[var(--toolbar-background)] pl-5 pr-3 backdrop-blur-xl [html[data-platform=win32]_&]:pr-[150px]">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[15px] font-semibold leading-5">{title}</h1>
        {subtitle && <p className="truncate text-xs text-label-secondary">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </header>
  )
}
