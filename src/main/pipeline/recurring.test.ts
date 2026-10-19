import { describe, expect, it } from 'vitest'
import { detectRecurring } from './recurring'
import { projectMonths } from './projection'

const netflix = (date: string, amountCents = -5590) => ({
  descriptionNorm: 'NETFLIX',
  date,
  amountCents,
  installmentTotal: null
})

describe('detectRecurring', () => {
  it('detecta cobrança mensal estável', () => {
    const [charge] = detectRecurring([netflix('2024-01-10'), netflix('2024-02-10'), netflix('2024-03-11')], '2024-03-20')
    expect(charge).toMatchObject({ descriptionNorm: 'NETFLIX', averageCents: 5590, occurrences: 3 })
    expect(charge?.nextDate).toBe('2024-04-11')
  })

  it('assinatura cancelada (sem cobrança há mais de 45 dias) não aparece', () => {
    const charges = [netflix('2024-01-10'), netflix('2024-02-10'), netflix('2024-03-11')]
    expect(detectRecurring(charges, '2024-04-25')).toHaveLength(1)
    expect(detectRecurring(charges, '2024-04-26')).toEqual([])
  })

  it('cobrança várias vezes por mês (ex.: 99) é hábito, não assinatura', () => {
    const rides = ['2024-01', '2024-02', '2024-03'].flatMap((m) =>
      ['05', '12', '20'].map((d) => ({ descriptionNorm: '99', date: `${m}-${d}`, amountCents: -2500, installmentTotal: null }))
    )
    expect(detectRecurring(rides, '2024-03-25')).toEqual([])
  })

  it('gasto mensal que varia (ex.: mercado) não é assinatura', () => {
    const market = [48000, 50100, 52200, 54300].map((cents, i) => ({
      descriptionNorm: 'SUPERMERCADO',
      date: `2024-0${i + 1}-15`,
      amountCents: -cents,
      installmentTotal: null
    }))
    expect(detectRecurring(market, '2024-04-20')).toEqual([])
  })

  it('próxima cobrança respeita o fim do mês', () => {
    const [charge] = detectRecurring([netflix('2024-11-30'), netflix('2024-12-31'), netflix('2025-01-31')], '2025-02-01')
    expect(charge?.nextDate).toBe('2025-02-28')
  })

  it('ignora valores instáveis, poucas ocorrências e parcelas', () => {
    const today = '2024-03-20'
    expect(detectRecurring([netflix('2024-01-10'), netflix('2024-02-10')], today)).toEqual([])
    expect(
      detectRecurring([netflix('2024-01-10'), netflix('2024-02-10', -20000), netflix('2024-03-10')], today)
    ).toEqual([])
    expect(
      detectRecurring(
        ['2024-01-10', '2024-02-10', '2024-03-10'].map((d) => ({ ...netflix(d), installmentTotal: 3 })),
        today
      )
    ).toEqual([])
  })
})

describe('projectMonths', () => {
  it('soma parcelas restantes, lançados e assinaturas', () => {
    const projection = projectMonths(
      [
        // 2/3 lançada em maio: falta 3/3 em junho
        { accountId: 1, descriptionNorm: 'LOJA', amountCents: -1000, installmentCurrent: 2, installmentTotal: 3, month: '2024-05' },
        { accountId: 1, descriptionNorm: 'LOJA', amountCents: -1000, installmentCurrent: 1, installmentTotal: 3, month: '2024-04' },
        { accountId: 1, descriptionNorm: 'MERCADO', amountCents: -3000, installmentCurrent: null, installmentTotal: null, month: '2024-05' }
      ],
      [{ descriptionNorm: 'NETFLIX', averageCents: 5590, occurrences: 3, lastDate: '2024-05-10', nextDate: '2024-06-10', categoryId: null }],
      '2024-05',
      3
    )
    expect(projection).toEqual([
      { month: '2024-05', postedCents: 4000, installmentsCents: 0, recurringCents: 0, totalCents: 4000 },
      { month: '2024-06', postedCents: 0, installmentsCents: 1000, recurringCents: 5590, totalCents: 6590 },
      { month: '2024-07', postedCents: 0, installmentsCents: 0, recurringCents: 5590, totalCents: 5590 }
    ])
  })
})
