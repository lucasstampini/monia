import { count, eq } from 'drizzle-orm'
import type { MatchType } from '@shared/types'
import type { Db } from './client'
import { categories, rules } from './schema'

/** Categorias que não são consumo: ficam fora dos gráficos de gasto para não contar em dobro. */
export const NON_SPENDING_CATEGORIES = ['Pagamento de fatura', 'Transferência entre contas', 'Investimentos']

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

const DEFAULT_RULES: { pattern: string; matchType: MatchType; category: string }[] = [
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

/** Popula categorias e regras padrão só na primeira execução. */
export function seed(db: Db): void {
  const [{ total } = { total: 0 }] = db.select({ total: count() }).from(categories).all()
  if (total > 0) return

  db.transaction((tx) => {
    tx.insert(categories).values(DEFAULT_CATEGORIES).run()
    for (const [index, rule] of DEFAULT_RULES.entries()) {
      const category = tx.select().from(categories).where(eq(categories.name, rule.category)).get()
      if (!category) continue
      tx.insert(rules)
        .values({
          pattern: rule.pattern,
          matchType: rule.matchType,
          categoryId: category.id,
          // Padrões mais específicos (listados antes) vencem.
          priority: DEFAULT_RULES.length - index,
          origin: 'manual'
        })
        .run()
    }
  })
}
