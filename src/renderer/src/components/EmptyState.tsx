import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({
  icon: Icon,
  title,
  message,
  action
}: {
  icon: LucideIcon
  title: string
  message: string
  action?: ReactNode
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
      <Icon size={40} strokeWidth={1.25} className="mb-1 text-label-tertiary" />
      <h2 className="text-[15px] font-semibold">{title}</h2>
      <p className="max-w-sm text-label-secondary">{message}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
