import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchWithRetry } from './http'

describe('fetchWithRetry', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('tenta de novo em 503 e devolve o sucesso', async () => {
    vi.useFakeTimers()
    const statuses = [503, 503, 200]
    const fetchMock = vi.fn(async () => new Response('{}', { status: statuses.shift() }))
    vi.stubGlobal('fetch', fetchMock)
    const pending = fetchWithRetry('https://x', { timeoutMs: 1000 })
    await vi.runAllTimersAsync()
    expect((await pending).status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('não insiste em erro definitivo', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 404 }))
    vi.stubGlobal('fetch', fetchMock)
    expect((await fetchWithRetry('https://x', { timeoutMs: 1000 })).status).toBe(404)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('desiste após o limite de tentativas', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn(async () => new Response('{}', { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)
    const pending = fetchWithRetry('https://x', { timeoutMs: 1000 }, 3)
    await vi.runAllTimersAsync()
    expect((await pending).status).toBe(503)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
