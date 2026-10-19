import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { SyncResult } from '@shared/types'
import { Button } from '../components/controls'
import { Sheet } from '../components/Sheet'

export type SyncState =
  | { status: 'idle' }
  | { status: 'running'; step: string; startedAt: number }
  | { status: 'done'; result: SyncResult }
  | { status: 'failed'; message: string }

/** Tempo decorrido (m:ss), para saber se o sync está andando ou parado. */
function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const seconds = Math.max(0, Math.floor((now - since) / 1000))
  return (
    <span className="tabular shrink-0 text-sm">
      {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
    </span>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-control bg-fill-quaternary px-3 py-2">
      <div className="tabular text-[17px] font-semibold">{value}</div>
      <div className="text-xs text-label-secondary">{label}</div>
    </div>
  )
}

export function SyncSheet({
  open,
  state,
  onClose,
  onStart,
  onOpenSettings
}: {
  open: boolean
  state: SyncState
  onClose: () => void
  onStart: () => void
  onOpenSettings: () => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Sincronizar com Open Finance">
      {state.status === 'idle' && (
        <>
          <p className="mb-4 text-label-secondary">
            Busca contas, faturas e transações das conexões do Meu Pluggy. Rodar de novo não duplica nada.
          </p>
          <div className="flex justify-end gap-2">
            <Button onClick={onClose}>Cancelar</Button>
            <Button variant="primary" onClick={onStart} autoFocus>
              Sincronizar
            </Button>
          </div>
        </>
      )}

      {state.status === 'running' && (
        <>
          <div className="flex items-center gap-2 py-3 text-label-secondary" role="status" aria-live="polite">
            <Loader2 size={16} className="shrink-0 animate-spin" />
            <motion.span key={state.step} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1">
              {state.step}
            </motion.span>
            <Elapsed since={state.startedAt} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="plain" onClick={() => void window.api.revealLogs()}>
              Mostrar log
            </Button>
            <Button onClick={onClose}>Continuar em segundo plano</Button>
          </div>
        </>
      )}

      {state.status === 'done' && (
        <>
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-income" />
            <span>Sincronização concluída.</span>
          </div>
          <div className="mb-3 grid grid-cols-3 gap-2">
            <Stat label="Novas" value={state.result.inserted} />
            <Stat label="Atualizadas" value={state.result.updated} />
            <Stat label="Contas" value={state.result.accounts} />
            <Stat label="Por regra" value={state.result.categorizedByRule} />
            <Stat label="Por IA" value={state.result.categorizedByAi} />
            <Stat label="Recebidas" value={state.result.received} />
          </div>
          {state.result.errors.length > 0 && (
            <details className="mb-3 rounded-control bg-fill-quaternary px-3 py-2 text-sm">
              <summary className="cursor-default text-label-secondary">
                {state.result.errors.length} aviso(s) — linhas com problema foram ignoradas
              </summary>
              <ul className="mt-2 max-h-40 list-disc overflow-y-auto pl-4 text-label-secondary">
                {state.result.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="plain" onClick={() => void window.api.revealLogs()}>
              Mostrar log
            </Button>
            <Button variant="primary" onClick={onClose} autoFocus>
              OK
            </Button>
          </div>
        </>
      )}

      {state.status === 'failed' && (
        <>
          <div className="mb-4 flex items-start gap-2">
            <AlertTriangle size={16} className="mt-px shrink-0 text-expense" />
            <span>{state.message}</span>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="plain" onClick={() => void window.api.revealLogs()}>
              Mostrar log
            </Button>
            <Button onClick={onOpenSettings}>Abrir Configurações</Button>
            <Button variant="primary" onClick={onStart}>
              Tentar de novo
            </Button>
          </div>
        </>
      )}
    </Sheet>
  )
}
