import { motion } from 'framer-motion'
import { CreditCard, Inbox, Landmark, LayoutDashboard, ListFilter, ListOrdered, RefreshCw, Settings } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Account } from '@shared/types'
import { formatDateTime } from '../lib/format'
import { spring } from '../lib/motion'

export type Screen = 'dashboard' | 'transactions' | 'review' | 'rules' | 'settings'

export interface Selection {
  screen: Screen
  accountId?: number
}

function SidebarItem({
  icon: Icon,
  label,
  selected,
  onClick,
  badge
}: {
  icon: LucideIcon
  label: string
  selected: boolean
  onClick: () => void
  badge?: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected ? 'page' : undefined}
      className="no-drag relative flex h-7 w-full items-center gap-2 rounded-control px-2 text-left"
    >
      {selected && (
        <motion.span layoutId="sidebar-selection" transition={spring} className="absolute inset-0 rounded-control bg-fill-tertiary" />
      )}
      <Icon size={16} strokeWidth={1.5} className="relative shrink-0 text-accent" />
      <span className="relative flex-1 truncate">{label}</span>
      {badge ? (
        <span className="tabular relative rounded-full bg-fill-tertiary px-1.5 text-xs font-medium text-label-secondary">
          {badge}
        </span>
      ) : null}
    </button>
  )
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="mb-0.5 mt-4 px-2 text-xs font-semibold text-label-tertiary">{children}</h2>
}

/** Source list no estilo do Finder, sobre o material translúcido da janela. */
export function Sidebar({
  selection,
  onSelect,
  accounts,
  lastSyncAt,
  syncing,
  onSync,
  reviewCount
}: {
  selection: Selection
  onSelect: (selection: Selection) => void
  accounts: Account[]
  lastSyncAt: string | null
  syncing: boolean
  onSync: () => void
  reviewCount: number
}) {
  const is = (screen: Screen, accountId?: number) =>
    selection.screen === screen && selection.accountId === accountId

  return (
    <nav
      aria-label="Navegação"
      className="drag flex w-[220px] shrink-0 flex-col border-r border-[var(--separator)] bg-[var(--sidebar-background)] px-2.5 pb-3 pt-[52px] [html[data-platform=darwin]_&]:bg-transparent"
    >
      <div className="flex-1 overflow-y-auto">
        <SectionTitle>Visão geral</SectionTitle>
        <SidebarItem icon={LayoutDashboard} label="Painel" selected={is('dashboard')} onClick={() => onSelect({ screen: 'dashboard' })} />
        <SidebarItem icon={ListFilter} label="Transações" selected={is('transactions')} onClick={() => onSelect({ screen: 'transactions' })} />

        {accounts.length > 0 && <SectionTitle>Contas</SectionTitle>}
        {accounts.map((account) => (
          <SidebarItem
            key={account.id}
            icon={account.type === 'credit' ? CreditCard : Landmark}
            label={account.name}
            selected={is('transactions', account.id)}
            onClick={() => onSelect({ screen: 'transactions', accountId: account.id })}
          />
        ))}

        <SectionTitle>Organizar</SectionTitle>
        <SidebarItem
          icon={Inbox}
          label="Revisar"
          badge={reviewCount}
          selected={is('review')}
          onClick={() => onSelect({ screen: 'review' })}
        />
        <SidebarItem icon={ListOrdered} label="Regras" selected={is('rules')} onClick={() => onSelect({ screen: 'rules' })} />
        <SidebarItem icon={Settings} label="Configurações" selected={is('settings')} onClick={() => onSelect({ screen: 'settings' })} />
      </div>

      <button
        type="button"
        onClick={onSync}
        disabled={syncing}
        className="no-drag mt-2 flex items-center gap-2 rounded-control px-2 py-1.5 text-left hover:bg-fill-quaternary disabled:opacity-60"
      >
        <RefreshCw size={14} strokeWidth={1.5} className={`text-label-secondary ${syncing ? 'animate-spin' : ''}`} />
        <span className="min-w-0">
          <span className="block text-sm font-medium">{syncing ? 'Sincronizando…' : 'Sincronizar'}</span>
          <span className="block truncate text-xs text-label-secondary">
            {lastSyncAt ? `Última: ${formatDateTime(lastSyncAt)}` : 'Nunca sincronizado'}
          </span>
        </span>
      </button>
    </nav>
  )
}
