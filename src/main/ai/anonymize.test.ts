import { describe, expect, it } from 'vitest'
import { anonymize, scrubDescription } from './anonymize'
import { parseCategorization } from './provider'

describe('scrubDescription', () => {
  it('remove CPF, CNPJ, e-mail e números longos', () => {
    expect(scrubDescription('BOLETO 12.345.678/0001-90')).toBe('BOLETO [doc]')
    expect(scrubDescription('COMPRA fulano@mail.com')).toBe('COMPRA [email]')
    expect(scrubDescription('CARTAO 4111 AG 98765')).toBe('CARTAO 4111 AG [num]')
  })

  it('tira o nome de quem está do outro lado de uma transferência', () => {
    expect(scrubDescription('TRANSFERENCIA ENVIADA PELO PIX MARIA DA SILVA')).toBe(
      'TRANSFERENCIA ENVIADA PELO PIX [destinatario]'
    )
    expect(scrubDescription('TRANSFERENCIA RECEBIDA JOAO 123.456.789-00')).toBe('TRANSFERENCIA RECEBIDA [destinatario]')
    expect(scrubDescription('REEMBOLSO RECEBIDO PELO PIX ANA LIMA')).toBe('REEMBOLSO RECEBIDO PELO PIX [destinatario]')
    expect(scrubDescription('TED PARA JOSE SOUZA')).toBe('TED PARA [destinatario]')
  })

  it('mantém transferências sem nome e lojas com PIX no meio da palavra', () => {
    expect(scrubDescription('PAGAMENTO DE PIX')).toBe('PAGAMENTO DE PIX')
    expect(scrubDescription('INTERNALTRANSFER')).toBe('INTERNALTRANSFER')
    expect(scrubDescription('PIXBET APOSTAS')).toBe('PIXBET APOSTAS')
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
