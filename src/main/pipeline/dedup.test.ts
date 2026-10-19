import { describe, expect, it } from 'vitest'
import { dedupHashes } from './dedup'

const coffee = { accountExternalId: 'acc', date: '2024-05-01', amountCents: -800, descriptionNorm: 'CAFE' }

describe('dedupHashes', () => {
  it('é determinístico: reimportar gera os mesmos hashes', () => {
    expect(dedupHashes([coffee])).toEqual(dedupHashes([coffee]))
  })

  it('duas compras idênticas no mesmo dia recebem hashes diferentes', () => {
    const [first, second] = dedupHashes([coffee, { ...coffee }])
    expect(first).not.toBe(second)
  })

  it('mesma compra em contas diferentes não colide', () => {
    const [a] = dedupHashes([coffee])
    const [b] = dedupHashes([{ ...coffee, accountExternalId: 'outra' }])
    expect(a).not.toBe(b)
  })
})
