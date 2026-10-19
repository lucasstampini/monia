import { describe, expect, it } from 'vitest'
import { detectInstallment, resolveInstallment } from './installments'

describe('detectInstallment', () => {
  it.each([
    ['NETSHOES PARC 03/10', { current: 3, total: 10 }],
    ['LOJA PARCELA 2 DE 6', { current: 2, total: 6 }],
    ['MAGALU 1/12', { current: 1, total: 12 }]
  ])('%s', (description, expected) => {
    expect(detectInstallment(description)).toEqual(expected)
  })

  it('ignora descrições sem parcela ou inconsistentes', () => {
    expect(detectInstallment('UBER TRIP')).toBeNull()
    expect(detectInstallment('LOJA 11/10')).toBeNull()
    expect(detectInstallment('LOJA 1/1')).toBeNull()
  })
})

describe('resolveInstallment', () => {
  it('prefere o dado da fonte', () => {
    expect(resolveInstallment('LOJA 1/3', { current: 2, total: 5 })).toEqual({ current: 2, total: 5 })
  })

  it('cai para a descrição quando a fonte não sabe', () => {
    expect(resolveInstallment('LOJA 1/3', { current: null, total: null })).toEqual({ current: 1, total: 3 })
  })
})
