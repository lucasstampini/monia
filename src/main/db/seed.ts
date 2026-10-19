import { and, count, eq, inArray } from 'drizzle-orm'
import type { MatchType } from '@shared/types'
import type { Db } from './client'
import { categories, rules, settings } from './schema'

/** Versão atual dos dados iniciais. Incrementar ao adicionar um bloco novo em `seed`. */
const SEED_VERSION = 3

/**
 * Categorias que não são consumo: ficam fora dos gráficos para não contar em dobro.
 * Usado só para marcar a flag `excludedFromSpending` na criação; depois o usuário decide.
 */
const NON_SPENDING_CATEGORIES = ['Pagamento de fatura', 'Transferência entre contas', 'Investimentos']

// Cores das categorias: paleta de cores do sistema da Apple.
const DEFAULT_CATEGORIES: { name: string; color: string }[] = [
  { name: 'Alimentação', color: '#FF9500' },
  { name: 'Mercado', color: '#34C759' },
  { name: 'Transporte', color: '#007AFF' },
  { name: 'Moradia', color: '#A2845E' },
  { name: 'Saúde', color: '#FF2D55' },
  { name: 'Lazer', color: '#AF52DE' },
  { name: 'Assinaturas', color: '#5856D6' },
  { name: 'Compras', color: '#FFCC00' },
  { name: 'Educação', color: '#5AC8FA' },
  { name: 'Viagem', color: '#30B0C7' },
  { name: 'Serviços', color: '#8E8E93' },
  { name: 'Impostos e taxas', color: '#FF3B30' },
  { name: 'Renda', color: '#00C7BE' },
  { name: 'Pagamento de fatura', color: '#AEAEB2' },
  { name: 'Transferência entre contas', color: '#636366' },
  { name: 'Investimentos', color: '#32ADE6' }
]

interface DefaultRule {
  pattern: string
  matchType: MatchType
  category: string
}

/** v1: primeira execução. A ordem define a prioridade (primeiro = maior). */
const DEFAULT_RULES: DefaultRule[] = [
  { pattern: 'IFOOD', matchType: 'contains', category: 'Alimentação' },
  { pattern: 'UBER EATS', matchType: 'contains', category: 'Alimentação' },
  { pattern: 'UBER', matchType: 'contains', category: 'Transporte' },
  { pattern: '99APP', matchType: 'contains', category: 'Transporte' },
  { pattern: 'POSTO', matchType: 'contains', category: 'Transporte' },
  { pattern: 'NETFLIX', matchType: 'contains', category: 'Assinaturas' },
  { pattern: 'SPOTIFY', matchType: 'contains', category: 'Assinaturas' },
  { pattern: 'DROGA', matchType: 'contains', category: 'Saúde' },
  { pattern: 'FARMACIA', matchType: 'contains', category: 'Saúde' },
  { pattern: 'SUPERMERCADO', matchType: 'contains', category: 'Mercado' },
  { pattern: 'PAGAMENTO DE FATURA', matchType: 'contains', category: 'Pagamento de fatura' },
  { pattern: 'PAGAMENTO RECEBIDO', matchType: 'contains', category: 'Pagamento de fatura' },
  { pattern: 'PAG FATURA', matchType: 'contains', category: 'Pagamento de fatura' }
]

/**
 * v2: regras vindas do uso real (descrições como aparecem no extrato/fatura do Nubank).
 * Só nomes de empresas; nunca nomes de pessoas. Prioridades acima das da v1,
 * com os casos específicos primeiro (ex.: "99FOOD" antes de "99", "AMAZON PRIME" antes de "AMAZON").
 */
const RULES_V2: DefaultRule[] = [
  // Assinaturas (antes de Compras, por causa de "AMAZON PRIME")
  ...['AMAZON PRIME', 'PRIME VIDEO', 'ANTHROPIC', 'CLAUDE.AI', 'OPENAI', 'CHATGPT', 'OBSIDIAN', 'ADOBE', 'CANVA',
    'GOOGLE ONE', 'YOUTUBE', 'DISNEY', 'HBO', 'APPLE.COM', 'ICLOUD', 'DEEZER', 'GITHUB'].map(
    (pattern): DefaultRule => ({ pattern, matchType: 'contains', category: 'Assinaturas' })
  ),
  // 99 aparece como "99", "99 POP", "PIX 99 TECNOLOGIA LTDA", "ESTORNO DE 99" e "99FOOD"
  { pattern: '99FOOD', matchType: 'contains', category: 'Alimentação' },
  { pattern: '^99( |$)', matchType: 'regex', category: 'Transporte' },
  { pattern: '99 TECNOLOGIA', matchType: 'contains', category: 'Transporte' },
  { pattern: 'ESTORNO DE 99', matchType: 'contains', category: 'Transporte' },
  // Transporte público e mobilidade em SP
  ...['AUTOPASS', 'TOP SP', 'CPTM', 'SPTRANS', 'TEMBICI', 'SEM PARAR', 'ESTAPAR'].map(
    (pattern): DefaultRule => ({ pattern, matchType: 'contains', category: 'Transporte' })
  ),
  { pattern: '\\bMETRO\\b', matchType: 'regex', category: 'Transporte' },
  // Investimentos e cashback
  { pattern: '^(APLICACAO|RESGATE) (EM )?(RDB|CDB|LCI|LCA|TESOURO|POUPANCA)', matchType: 'regex', category: 'Investimentos' },
  { pattern: 'RECEBIDO DE INVESTIMENTOS', matchType: 'contains', category: 'Investimentos' },
  { pattern: 'CASHBACK', matchType: 'contains', category: 'Renda' },
  // IOF (compra internacional e devolução)
  { pattern: '^IOF\\b', matchType: 'regex', category: 'Impostos e taxas' },
  // Compras online
  ...['AMAZON', 'MERCADOLIVRE', 'MERCADO LIVRE', 'AMERICANAS', 'SHOPEE', 'ALIEXPRESS', 'MAGALU', 'SHEIN'].map(
    (pattern): DefaultRule => ({ pattern, matchType: 'contains', category: 'Compras' })
  ),
  // Saúde, moradia, mercado e alimentação
  ...['PHARMA', 'RAIA', 'PAGUE MENOS'].map((pattern): DefaultRule => ({ pattern, matchType: 'contains', category: 'Saúde' })),
  ...['SABESP', 'BRK AMBIENTAL', 'ENEL', 'CPFL', 'COMGAS'].map(
    (pattern): DefaultRule => ({ pattern, matchType: 'contains', category: 'Moradia' })
  ),
  ...['ASSAI', 'CARREFOUR', 'ATACADAO', 'PAO DE ACUCAR', 'VAREJAO'].map(
    (pattern): DefaultRule => ({ pattern, matchType: 'contains', category: 'Mercado' })
  ),
  ...['RESTAURANTE', 'LANCHONETE', 'PADARIA', 'BURGER', 'MCDONALDS', 'STARBUCKS'].map(
    (pattern): DefaultRule => ({ pattern, matchType: 'contains', category: 'Alimentação' })
  )
]

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

/** Insere regras padrão; a primeira da lista recebe `basePriority + tamanho` e as seguintes vão diminuindo. */
function insertRules(tx: Tx, list: DefaultRule[], basePriority: number): void {
  for (const [index, rule] of list.entries()) {
    const category = tx.select().from(categories).where(eq(categories.name, rule.category)).get()
    if (!category) continue
    const exists = tx
      .select()
      .from(rules)
      .where(and(eq(rules.pattern, rule.pattern), eq(rules.matchType, rule.matchType)))
      .get()
    if (exists) continue
    tx.insert(rules)
      .values({
        pattern: rule.pattern,
        matchType: rule.matchType,
        categoryId: category.id,
        priority: basePriority + list.length - index,
        origin: 'manual'
      })
      .run()
  }
}

/**
 * Dados iniciais versionados. Cada versão roda uma única vez por banco,
 * então regras padrão novas chegam a quem já usa o app, e uma regra
 * que você apagou não volta na próxima abertura.
 * Retorna true quando algo novo foi aplicado (as transações precisam ser recategorizadas).
 */
export function seed(db: Db): boolean {
  const stored = db.select().from(settings).where(eq(settings.key, 'seedVersion')).get()?.value
  const [{ total } = { total: 0 }] = db.select({ total: count() }).from(categories).all()
  // Bancos criados antes do versionamento já têm a v1.
  const current = stored ? Number(stored) : total > 0 ? 1 : 0

  db.transaction((tx) => {
    if (current < 1) {
      tx.insert(categories).values(DEFAULT_CATEGORIES).run()
      insertRules(tx, DEFAULT_RULES, 0)
    }
    if (current < 2) insertRules(tx, RULES_V2, 20)
    if (current < 3) {
      // Antes o "não conta como gasto" era decidido pelo nome; agora é uma opção da categoria.
      tx.update(categories)
        .set({ excludedFromSpending: true })
        .where(inArray(categories.name, NON_SPENDING_CATEGORIES))
        .run()
    }
    if (current < SEED_VERSION) {
      tx.insert(settings)
        .values({ key: 'seedVersion', value: String(SEED_VERSION) })
        .onConflictDoUpdate({ target: settings.key, set: { value: String(SEED_VERSION) } })
        .run()
    }
  })
  return current < SEED_VERSION
}
