import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextPagePath, PluggyClient } from './client'

const params = { accountId: 'acc', dateFrom: '2024-01-01' }

describe('nextPagePath', () => {
  it('concatena a query string relativa ao endpoint (formato real da Pluggy)', () => {
    expect(nextPagePath('/v2/transactions', params, '?accountId=acc&dateFrom=2024-01-01&after=Yz0%3D')).toBe(
      '/v2/transactions?accountId=acc&dateFrom=2024-01-01&after=Yz0%3D'
    )
  })

  it('aceita URL completa, caminho absoluto e cursor puro', () => {
    expect(nextPagePath('/v2/transactions', params, 'https://api.pluggy.ai/v2/transactions?after=c2')).toBe(
      '/v2/transactions?after=c2'
    )
    expect(nextPagePath('/v2/transactions', params, '/v2/transactions?after=c2')).toBe('/v2/transactions?after=c2')
    expect(nextPagePath('/v2/transactions', params, 'c2')).toBe(
      '/v2/transactions?accountId=acc&dateFrom=2024-01-01&after=c2'
    )
  })

  it('fim da lista', () => {
    expect(nextPagePath('/v2/transactions', params, null)).toBeNull()
    expect(nextPagePath('/v2/transactions', params, '')).toBeNull()
  })
})

describe('PluggyClient.getAllByCursor', () => {
  afterEach(() => vi.unstubAllGlobals())

  function json(body: unknown) {
    return new Response(JSON.stringify(body), { status: 200 })
  }

  it('segue `next` até vir vazio, sem reencodar o cursor', async () => {
    const urls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(url)
        if (url.endsWith('/auth')) return json({ apiKey: 'k' })
        if (!url.includes('after=')) return json({ results: [1, 2], next: '?accountId=acc&after=Yz0%3D' })
        return json({ results: [3], next: null })
      })
    )
    const client = new PluggyClient({ clientId: 'id', clientSecret: 'secret' })
    expect(await client.getAllByCursor('/v2/transactions', params)).toEqual([1, 2, 3])
    expect(urls[1]).toBe('https://api.pluggy.ai/v2/transactions?accountId=acc&dateFrom=2024-01-01')
    expect(urls[2]).toBe('https://api.pluggy.ai/v2/transactions?accountId=acc&after=Yz0%3D')
  })

  it('não entra em loop se `next` se repetir', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/auth') ? json({ apiKey: 'k' }) : json({ results: [1], next: '?after=mesmo' })
      )
    )
    const client = new PluggyClient({ clientId: 'id', clientSecret: 'secret' })
    expect(await client.getAllByCursor('/v2/transactions', params)).toEqual([1, 1])
  })
})
