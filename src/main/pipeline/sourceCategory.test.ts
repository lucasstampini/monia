import { describe, expect, it } from 'vitest'
import { mapSourceCategory } from './sourceCategory'

describe('mapSourceCategory', () => {
  it.each([
    ['Same person transfer - PIX', 'Transferência entre contas'],
    ['Credit card payment', 'Pagamento de fatura'],
    ['Fixed income', 'Investimentos'],
    ['Proceeds interests and dividends', 'Investimentos'],
    ['Taxi and ride-hailing', 'Transporte'],
    ['Public transportation', 'Transporte'],
    ['Food delivery', 'Alimentação'],
    ['Groceries', 'Mercado'],
    ['Pharmacy', 'Saúde'],
    ['Digital services', 'Assinaturas'],
    ['Online shopping', 'Compras'],
    ['Salary', 'Renda'],
    ['Taxes', 'Impostos e taxas']
  ])('%s -> %s', (source, expected) => {
    expect(mapSourceCategory(source)).toBe(expected)
  })

  it('transferência para terceiros fica para revisão manual', () => {
    expect(mapSourceCategory('Transfer - PIX')).toBeNull()
    expect(mapSourceCategory('Third-party transfer - PIX')).toBeNull()
    expect(mapSourceCategory('Transfers')).toBeNull()
  })

  it('sem categoria ou desconhecida', () => {
    expect(mapSourceCategory(null)).toBeNull()
    expect(mapSourceCategory('Algo novo')).toBeNull()
  })
})
