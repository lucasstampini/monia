import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Sidebar, type Selection } from './components/Sidebar'
import { errorMessage, useAsync } from './lib/useAsync'
import { Dashboard } from './screens/Dashboard'
import { Rules } from './screens/Rules'
import { SettingsScreen } from './screens/Settings'
import { SyncSheet, type SyncState } from './screens/SyncSheet'
import { Transactions } from './screens/Transactions'

function applyAccent(accent: string) {
  document.documentElement.style.setProperty('--accent', accent)
}

export function App() {
  const [selection, setSelection] = useState<Selection>({ screen: 'dashboard' })
  /** Incrementa quando os dados mudam (sync, recategorização), para as telas recarregarem. */
  const [dataVersion, setDataVersion] = useState(0)
  const [syncOpen, setSyncOpen] = useState(false)
  const [syncState, setSyncState] = useState<SyncState>({ status: 'idle' })
  const searchRef = useRef<HTMLInputElement>(null)

  const accounts = useAsync(() => window.api.listAccounts(), [dataVersion])
  const categories = useAsync(() => window.api.listCategories(), [dataVersion])
  const settings = useAsync(() => window.api.getSettings(), [dataVersion])
  const bumpData = useCallback(() => setDataVersion((v) => v + 1), [])

  // Aparência: plataforma (para o material da janela) e cor de destaque do sistema.
  useEffect(() => {
    void window.api.getAppearance().then(({ accent, platform }) => {
      document.documentElement.dataset['platform'] = platform
      applyAccent(accent)
    })
    return window.api.onAccentChange(applyAccent)
  }, [])

  const startSync = useCallback(async () => {
    setSyncOpen(true)
    setSyncState({ status: 'running', step: 'Iniciando…', startedAt: Date.now() })
    try {
      const result = await window.api.sync()
      setSyncState({ status: 'done', result })
      bumpData()
    } catch (error) {
      setSyncState({ status: 'failed', message: errorMessage(error) })
    }
  }, [bumpData])

  useEffect(
    () =>
      window.api.onSyncProgress(({ step }) =>
        setSyncState((state) => ({ status: 'running', step, startedAt: state.status === 'running' ? state.startedAt : Date.now() }))
      ),
    []
  )

  const openSync = useCallback(() => {
    setSyncState((state) => (state.status === 'running' ? state : { status: 'idle' }))
    setSyncOpen(true)
  }, [])

  // Comandos do menu de aplicativo (atalhos de teclado).
  useEffect(
    () =>
      window.api.onMenuCommand((command) => {
        switch (command) {
          case 'sync':
            openSync()
            break
          case 'settings':
            setSelection({ screen: 'settings' })
            break
          case 'search':
            setSelection((s) => (s.screen === 'transactions' ? s : { screen: 'transactions' }))
            setTimeout(() => searchRef.current?.focus(), 50)
            break
          case 'navigate-dashboard':
            setSelection({ screen: 'dashboard' })
            break
          case 'navigate-transactions':
            setSelection({ screen: 'transactions' })
            break
          case 'navigate-rules':
            setSelection({ screen: 'rules' })
            break
        }
      }),
    [openSync]
  )

  const categoryList = categories.data ?? []
  const accountList = accounts.data ?? []
  const screenKey = `${selection.screen}-${selection.accountId ?? ''}`

  return (
    <div className="flex h-full">
      <Sidebar
        selection={selection}
        onSelect={setSelection}
        accounts={accountList}
        lastSyncAt={settings.data?.lastSyncAt ?? null}
        syncing={syncState.status === 'running'}
        onSync={openSync}
      />

      <main className="relative flex min-w-0 flex-1 flex-col bg-content-bg">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={screenKey}
            className="flex min-h-0 flex-1 flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            {selection.screen === 'dashboard' && (
              <Dashboard
                categories={categoryList}
                dataVersion={dataVersion}
                hasAccounts={accountList.length > 0}
                onSync={openSync}
              />
            )}
            {selection.screen === 'transactions' && (
              <Transactions
                accounts={accountList}
                categories={categoryList}
                accountId={selection.accountId}
                dataVersion={dataVersion}
                onDataChanged={bumpData}
                searchRef={searchRef}
                onSync={openSync}
              />
            )}
            {selection.screen === 'rules' && <Rules categories={categoryList} onDataChanged={bumpData} />}
            {selection.screen === 'settings' && settings.data && (
              <SettingsScreen settings={settings.data} onSaved={bumpData} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <SyncSheet
        open={syncOpen}
        state={syncState}
        onClose={() => setSyncOpen(false)}
        onStart={() => void startSync()}
        onOpenSettings={() => {
          setSyncOpen(false)
          setSelection({ screen: 'settings' })
        }}
      />
    </div>
  )
}
