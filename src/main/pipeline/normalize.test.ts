import { describe, expect, it } from 'vitest'
import {
  addMonths,
  billMonthFor,
  inferCloseDay,
  normalizeDescription,
  statementMonthFor,
  toCents,
  toLocalDate
} from './normalize'

describe('toCents', () => {
  it('converte sem erro de ponto flutuante', () => {
    expect(toCents(0.1 + 0.2)).toBe(30)
    expect(toCents(19.99)).toBe(1999)
    expect(toCents(-1234.5)).toBe(-123450)
  })

  it('rejeita valores não finitos', () => {
    expect(() => toCents(Number.NaN)).toThrow()
  })
})

describe('toLocalDate', () => {
  it('converte UTC para o dia em São Paulo', () => {
    // 02:00 UTC do dia 3 ainda é dia 2 em São Paulo (UTC-3).
    expect(toLocalDate('2024-05-03T02:00:00.000Z')).toBe('2024-05-02')
    expect(toLocalDate('2024-05-03T03:00:00.000Z')).toBe('2024-05-03')
  })

  it('mantém datas puras como estão', () => {
    expect(toLocalDate('2024-12-31')).toBe('2024-12-31')
  })
})

describe('addMonths', () => {
  it('atravessa a virada do ano', () => {
    expect(addMonths('2024-11', 3)).toBe('2025-02')
    expect(addMonths('2024-01', -1)).toBe('2023-12')
  })
})

describe('normalizeDescription', () => {
  it('remove acentos, parcela, dígitos longos e pontuação', () => {
    expect(normalizeDescription('Pão de Açúcar  *Loja 12345678')).toBe('PAO DE ACUCAR LOJA')
    expect(normalizeDescription('NETSHOES PARC 03/10')).toBe('NETSHOES')
    expect(normalizeDescription('Mercado Livre 3/10')).toBe('MERCADO LIVRE')
    expect(normalizeDescription('IFD*IFOOD.COM')).toBe('IFD IFOOD.COM')
  })
})

describe('statementMonthFor', () => {
  it('compra antes do fechamento cai na fatura do mês', () => {
    expect(statementMonthFor('2026-10-23', 24)).toBe('2026-10')
  })

  it('compra no dia do fechamento ou depois vai para a próxima', () => {
    expect(statementMonthFor('2026-09-24', 24)).toBe('2026-10')
    expect(statementMonthFor('2026-12-30', 24)).toBe('2027-01')
  })
})

describe('billMonthFor', () => {
  it('conta a fatura pelo fechamento, mesmo com o vencimento oscilando entre dia 30 e dia 2', () => {
    // fecha dia 24
    expect(billMonthFor('2026-09-30', 24)).toBe('2026-09')
    expect(billMonthFor('2026-11-02', 24)).toBe('2026-10')
    expect(billMonthFor('2026-08-02', 24)).toBe('2026-07')
  })
})

describe('inferCloseDay', () => {
  it('usa o dia da compra mais antiga de cada fatura, o mais frequente', () => {
    const purchases = [
      { date: '2026-09-24', billId: 'out' },
      { date: '2026-10-20', billId: 'out' },
      { date: '2026-08-24', billId: 'set' },
      { date: '2026-09-10', billId: 'set' },
      { date: '2026-06-23', billId: 'jul' },
      { date: '2026-11-03', billId: null }
    ]
    expect(inferCloseDay(purchases)).toBe(24)
  })

  it('sem fatura fechada, não sabe', () => {
    expect(inferCloseDay([{ date: '2026-11-03', billId: null }])).toBeNull()
  })
})
