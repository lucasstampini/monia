import { describe, expect, it } from 'vitest'
import { anonymize, scrubDescription } from './anonymize'
import { parseCategorization } from './provider'

describe('scrubDescription', () => {
  it('remove CPF, CNPJ, e-mail e números longos', () => {
    expect(scrubDescription('PIX JOAO 123.456.789-00')).toBe('PIX JOAO [doc]')
    expect(scrubDescription('BOLETO 12.345.678/0001-90')).toBe('BOLETO [doc]')
    expect(scrubDescription('TED fulano@mail.com')).toBe('TED [email]')
    expect(scrubDescription('CARTAO 4111 AG 98765')).toBe('CARTAO 4111 AG [num]')
  })
})

describe('anonymize', () => {
  it('envia só descrição, valor, data e um ref local', () => {
    const [out] = anonymize([{ descriptionNorm: 'LOJA', amountCents: -500, date: '2024-01-01' }])
    expect(out).toEqual({ ref: 0, description: 'LOJA', amountCents: -500, date: '2024-01-01' })
  })
})

describe('parseCategorization', () => {
  const valid = new Set([1, 2])

  it('aceita JSON válido e anula ids desconhecidos', () => {
    const raw = JSON.stringify({ results: [{ ref: 0, categoryId: 1 }, { ref: 1, categoryId: 7 }] })
    expect(parseCategorization(raw, valid)).toEqual([
      { ref: 0, categoryId: 1 },
      { ref: 1, categoryId: null }
    ])
  })

  it('JSON quebrado ou fora do schema retorna vazio', () => {
    expect(parseCategorization('não é json', valid)).toEqual([])
    expect(parseCategorization('{"results":[{"ref":"a"}]}', valid)).toEqual([])
  })
})
