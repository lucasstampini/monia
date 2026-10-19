import { afterEach, describe, expect, it, vi } from 'vitest'
import { cursorFromNext, PluggyClient } from './client'

describe('cursorFromNext', () => {
  it('extrai o `after` de uma URL', () => {
    expect(cursorFromNext('https://api.pluggy.ai/v2/transactions?accountId=a&after=abc%3D%3D')).toBe('abc==')
  })

  it('aceita cursor puro e trata fim da lista', () => {
    expect(cursorFromNext('abc')).toBe('abc')
    expect(cursorFromNext(null)).toBeNull()
    expect(cursorFromNext(undefined)).toBeNull()
  })
})

describe('PluggyClient.getAllByCursor', () => {
  afterEach(() => vi.unstubAllGlobals())

  function json(body: unknown) {
    return new Response(JSON.stringify(body), { status: 200 })
  }

  it('segue o cursor até `next` vir vazio', async () => {
    const urls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(url)
        if (url.endsWith('/auth')) return json({ apiKey: 'k' })
        if (!url.includes('after=')) return json({ results: [1, 2], next: 'https://api.pluggy.ai/v2/transactions?after=c2' })
        return json({ results: [3], next: null })
      })
    )
    const client = new PluggyClient({ clientId: 'id', clientSecret: 'secret' })
    const all = await client.getAllByCursor('/v2/transactions', { accountId: 'acc', dateFrom: '2024-01-01' })
    expect(all).toEqual([1, 2, 3])
    expect(urls[1]).toContain('/v2/transactions?accountId=acc&dateFrom=2024-01-01')
    expect(urls[2]).toContain('after=c2')
  })

  it('não entra em loop se o cursor se repetir', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/auth') ? json({ apiKey: 'k' }) : json({ results: [1], next: 'mesmo' })
      )
    )
    const client = new PluggyClient({ clientId: 'id', clientSecret: 'secret' })
    expect(await client.getAllByCursor('/v2/transactions', { accountId: 'acc' })).toEqual([1, 1])
  })
})
