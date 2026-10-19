import { useCallback, useEffect, useState } from 'react'

export interface AsyncState<T> {
  data: T | undefined
  error: string | null
  loading: boolean
  reload: () => void
}

/** Carrega dados do main via `window.api` e recarrega quando `deps` mudam. */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T>()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    load()
      .then((value) => {
        if (cancelled) return
        setData(value)
        setError(null)
      })
      .catch((err: unknown) => !cancelled && setError(errorMessage(err)))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
    // `load` muda a cada render; quem decide quando recarregar são as `deps`.
  }, [...deps, version])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  return { data, error, loading, reload }
}

/** Erros do IPC chegam como "Error invoking remote method 'x': Error: msg". Mostramos só a msg. */
export function errorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  return text.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}
