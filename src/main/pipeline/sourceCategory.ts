/**
 * Traduz a categoria que a fonte (Pluggy) já manda em cada transação para uma categoria nossa.
 * Casamos por palavra-chave no nome em inglês ("Same person transfer - PIX", "Taxi and ride-hailing"...),
 * então subcategorias novas da Pluggy continuam funcionando.
 *
 * Transferência para terceiros (Pix para um amigo) fica de fora de propósito:
 * só você sabe se foi racha de jantar, aluguel ou presente. Vai para revisão manual.
 */

interface Mapping {
  pattern: RegExp
  category: string
}

// Ordem importa: o primeiro que casar vence. Casos específicos antes dos genéricos.
const MAPPINGS: Mapping[] = [
  { pattern: /same person transfer/i, category: 'Transferência entre contas' },
  { pattern: /credit card payment/i, category: 'Pagamento de fatura' },
  {
    pattern: /investment|fixed income|mutual fund|variable income|pension|proceeds interests|dividend/i,
    category: 'Investimentos'
  },
  { pattern: /third-party transfer|^transfers?\b|transfer -|bank slip|boleto/i, category: '' },
  { pattern: /salary|retirement|entrepreneurial|government aid|^income/i, category: 'Renda' },
  // `\btax` com fim de palavra: "Taxi" não é imposto.
  { pattern: /\btax(es)?\b|\biof\b/i, category: 'Impostos e taxas' },
  { pattern: /bank fees|interests charged|late payment|overdraft/i, category: 'Impostos e taxas' },
  { pattern: /groceries|supermarket/i, category: 'Mercado' },
  { pattern: /food|restaurant|eating out|delivery|bakery|coffee/i, category: 'Alimentação' },
  {
    pattern: /taxi|ride-hailing|public transport|transportation|gas station|fuel|parking|toll|automotive|bicycle/i,
    category: 'Transporte'
  },
  { pattern: /pharmac|health|hospital|dentist|optometr|wellness|fitness|gym/i, category: 'Saúde' },
  { pattern: /digital services|streaming|software|video on demand|music/i, category: 'Assinaturas' },
  { pattern: /education|school|universit|course|book/i, category: 'Educação' },
  { pattern: /housing|rent|utilities|electricity|water|gas\b|condominium/i, category: 'Moradia' },
  { pattern: /travel|airline|accommodation|hotel|mileage|bus ticket/i, category: 'Viagem' },
  { pattern: /leisure|entertainment|cinema|tickets|gaming|sport|gambling|lottery|bet/i, category: 'Lazer' },
  { pattern: /telecommunication|internet|mobile|insurance|services/i, category: 'Serviços' },
  { pattern: /shopping|clothing|electronics|department store|pet|gift|donation/i, category: 'Compras' }
]

/** Retorna o nome da nossa categoria, ou null quando não há tradução segura. */
export function mapSourceCategory(sourceCategory: string | null | undefined): string | null {
  if (!sourceCategory) return null
  const match = MAPPINGS.find((m) => m.pattern.test(sourceCategory))
  return match?.category || null
}
