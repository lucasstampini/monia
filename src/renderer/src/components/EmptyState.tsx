import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({
  icon: Icon,
  visual,
  title,
  message,
  action
}: {
  icon?: LucideIcon
  /** Alternativa ao ícone (ex.: o símbolo da marca na tela de boas-vindas). */
  visual?: ReactNode
  title: string
  message: string
  action?: ReactNode
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
      {visual ?? (Icon && <Icon size={40} strokeWidth={1.25} className="mb-1 text-label-tertiary" />)}
      <h2 className="text-[20px] font-semibold tracking-[-0.03em]">{title}</h2>
      <p className="max-w-sm text-label-secondary">{message}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
