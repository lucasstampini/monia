import { describe, expect, it } from 'vitest'
import { closeDayFor, mapAccount, mapBill, mapTransaction, type BillingCycle } from './adapter'
import { accountSchema, billSchema, transactionSchema } from './schemas'

// Fixtures no formato da API da Pluggy (campos extras são ignorados pelo Zod).
const creditAccount = accountSchema.parse({
  id: 'acc-credit',
  type: 'CREDIT',
  subtype: 'CREDIT_CARD',
  name: 'Mastercard Black',
  marketingName: 'Ultravioleta',
  number: '1234',
  creditData: { balanceCloseDate: '2024-05-03T03:00:00.000Z', balanceDueDate: '2024-05-10T03:00:00.000Z' }
})

const bankAccount = accountSchema.parse({ id: 'acc-bank', type: 'BANK', name: 'Conta Corrente' })

// Fecha dia 3 (como a creditData da conta acima), sem faturas fechadas.
const noBills: BillingCycle = { billMonthById: new Map(), closeDay: 3 }

describe('mapAccount', () => {
  it('converte tipo e prefere o nome comercial', () => {
    expect(mapAccount(creditAccount, 'Nubank', 'item-1')).toEqual({
      externalId: 'acc-credit',
      institution: 'Nubank',
      name: 'Ultravioleta',
      type: 'credit',
      sourceItemId: 'item-1'
    })
    expect(mapAccount(bankAccount, 'Nubank', 'item-1').type).toBe('checking')
  })
})

describe('mapTransaction', () => {
  it('compra no cartão: negativa, parcela e mês da fatura pelo billId', () => {
    const tx = transactionSchema.parse({
      id: 'tx-1',
      description: 'NETSHOES',
      amount: 99.9,
      date: '2024-04-20T03:00:00.000Z',
      type: 'DEBIT',
      category: 'Shopping',
      creditCardMetadata: { installmentNumber: 2, totalInstallments: 5, billId: 'bill-1' }
    })
    const result = mapTransaction(tx, creditAccount, { billMonthById: new Map([['bill-1', '2024-06']]), closeDay: 3 })
    expect(result).toEqual({
      externalId: 'tx-1',
      accountExternalId: 'acc-credit',
      date: '2024-04-20',
      description: 'NETSHOES',
      amountCents: -9990,
      installmentCurrent: 2,
      installmentTotal: 5,
      statementMonth: '2024-06',
      sourceCategory: 'Shopping'
    })
  })

  it('sem billId (fatura aberta ou parcela futura), calcula o mês da fatura pelo fechamento', () => {
    const tx = transactionSchema.parse({ id: 'tx-2', description: 'UBER', amount: 20, date: '2024-05-04', type: 'DEBIT' })
    expect(mapTransaction(tx, creditAccount, noBills).statementMonth).toBe('2024-06')
  })

  it('estorno no cartão é positivo', () => {
    const tx = transactionSchema.parse({ id: 'tx-3', description: 'ESTORNO', amount: -50, date: '2024-05-04', type: 'CREDIT' })
    expect(mapTransaction(tx, creditAccount, noBills).amountCents).toBe(5000)
  })

  it('conta corrente: usa o sinal do type e não tem mês de fatura', () => {
    const tx = transactionSchema.parse({ id: 'tx-4', description: 'PIX', amount: -120.5, date: '2024-05-04', type: 'DEBIT' })
    const result = mapTransaction(tx, bankAccount, { billMonthById: new Map(), closeDay: null })
    expect(result.amountCents).toBe(-12050)
    expect(result.statementMonth).toBeNull()
  })

  it('compra internacional usa o valor convertido para reais', () => {
    const tx = transactionSchema.parse({
      id: 'tx-5',
      description: 'AMAZON US',
      amount: 10,
      amountInAccountCurrency: 55.3,
      date: '2024-05-01',
      type: 'DEBIT'
    })
    expect(mapTransaction(tx, creditAccount, noBills).amountCents).toBe(-5530)
  })
})

describe('mapBill', () => {
  const bill = billSchema.parse({ id: 'b', dueDate: '2026-11-02T03:00:00.000Z', totalAmount: 1500.25 })

  it('conta o mês da fatura pelo fechamento', () => {
    expect(mapBill(bill, 'acc-credit', 24)).toEqual({
      accountExternalId: 'acc-credit',
      refMonth: '2026-10',
      closeDate: null,
      dueDate: '2026-11-02',
      totalCents: -150025
    })
  })

  it('sem dia de fechamento, usa o mês do vencimento', () => {
    expect(mapBill(bill, 'acc-credit', null).refMonth).toBe('2026-11')
  })
})

describe('closeDayFor', () => {
  const purchase = (id: string, date: string, billId?: string) =>
    transactionSchema.parse({
      id,
      description: 'COMPRA',
      amount: 10,
      date,
      type: 'DEBIT',
      ...(billId ? { creditCardMetadata: { billId } } : {})
    })

  it('prefere o fechamento deduzido das faturas ao da conta', () => {
    const transactions = [purchase('a', '2026-09-24', 'b1'), purchase('b', '2026-10-01', 'b1')]
    expect(closeDayFor(creditAccount, transactions)).toBe(24)
  })

  it('sem fatura fechada, usa a data de fechamento da conta', () => {
    expect(closeDayFor(creditAccount, [purchase('c', '2026-11-03')])).toBe(3)
  })
})
