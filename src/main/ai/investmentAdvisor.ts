import { z } from 'zod'
import type { InvestmentAdvice, InvestmentsOverview, KrakenClass } from '@shared/types'
import type { LLMClient } from './client'

/** Resumo que sai do app rumo à IA: só agregados. Nada de nome de produto, instituição ou conta. */
export interface PortfolioSummary {
  totalReais: number
  investedReais: number
  profitReais: number
  unclassifiedReais: number
  targetsDefined: boolean
  classes: { class: string; valueReais: number; currentPercent: number; targetPercent: number; gapReais: number }[]
  holdings: {
    class: KrakenClass | 'sem classe'
    type: string
    subtype: string | null
    count: number
    valueReais: number
    twelveMonthRatePercent: number | null
    rates: string[]
    nearestDueDate: string | null
  }[]
}

const reais = (cents: number) => Math.round(cents) / 100

function describeRate(rate: number | null, rateType: string | null, fixed: number | null): string | null {
  if (rate !== null && rateType) return `${rate}% do ${rateType}${fixed ? ` + ${fixed}% a.a.` : ''}`
  if (fixed !== null) return `${fixed}% a.a.${rateType ? ` + ${rateType}` : ''}`
  return null
}

/** Agrupa a carteira por classe + tipo + subtipo e descarta qualquer identificador. */
export function buildPortfolioSummary(overview: InvestmentsOverview): PortfolioSummary {
  const groups = new Map<string, PortfolioSummary['holdings'][number] & { weightedRate: number; ratedValue: number }>()
  for (const i of overview.investments) {
    const key = `${i.krakenClass ?? 'sem classe'}|${i.type}|${i.subtype ?? ''}`
    const group = groups.get(key) ?? {
      class: i.krakenClass ?? 'sem classe',
      type: i.type,
      subtype: i.subtype,
      count: 0,
      valueReais: 0,
      twelveMonthRatePercent: null,
      rates: [],
      nearestDueDate: null,
      weightedRate: 0,
      ratedValue: 0
    }
    group.count += 1
    group.valueReais += reais(i.balanceCents)
    if (i.lastTwelveMonthsRate !== null) {
      group.weightedRate += i.lastTwelveMonthsRate * i.balanceCents
      group.ratedValue += i.balanceCents
    }
    const rate = describeRate(i.rate, i.rateType, i.fixedAnnualRate)
    if (rate && !group.rates.includes(rate)) group.rates.push(rate)
    if (i.dueDate && (!group.nearestDueDate || i.dueDate < group.nearestDueDate)) group.nearestDueDate = i.dueDate
    groups.set(key, group)
  }

  return {
    totalReais: reais(overview.totalCents),
    investedReais: reais(overview.investedCents),
    profitReais: reais(overview.profitCents),
    unclassifiedReais: reais(overview.unclassifiedCents),
    targetsDefined: overview.targetsDefined,
    classes: overview.allocation.map((a) => ({
      class: a.label,
      valueReais: reais(a.valueCents),
      currentPercent: a.currentPercent,
      targetPercent: a.targetPercent,
      gapReais: reais(a.gapCents)
    })),
    holdings: [...groups.values()].map(({ weightedRate, ratedValue, ...group }) => ({
      ...group,
      valueReais: Math.round(group.valueReais * 100) / 100,
      twelveMonthRatePercent: ratedValue > 0 ? Math.round((weightedRate / ratedValue) * 100) / 100 : null
    }))
  }
}

export function buildAdvicePrompt(summary: PortfolioSummary): string {
  return [
    'Você é um assistente de educação financeira para um investidor pessoa física no Brasil.',
    'Ele organiza a carteira pela alocação KRAKEN, com 6 classes: caixa e renda fixa, FIIs e REITs,',
    'ações Brasil, cripto, exterior e oportunidades. As metas percentuais de cada classe são definidas por ele.',
    '',
    'Analise o resumo da carteira abaixo e diga o que ele deveria OLHAR antes de investir:',
    'distância de cada classe para a meta (onde aportar primeiro), concentração, liquidez da reserva,',
    'vencimentos próximos, rentabilidade em 12 meses comparada entre as próprias posições, e classes vazias.',
    '',
    'Regras:',
    '- Responda em português, de 3 a 6 itens, cada um com título curto e detalhe de no máximo 2 frases.',
    '- Use os números do resumo. Não invente dados que não estão nele (ex.: inflação, CDI atual, cotações).',
    '- Não recomende ativos, fundos, tickers ou instituições específicas. Fale de classes e características.',
    '- Se as metas não estiverem definidas (targetsDefined = false), o primeiro item deve pedir para defini-las.',
    '- Prioridade: "alta" para desvios grandes da meta ou riscos claros; "media" e "baixa" para o resto.',
    '',
    'Resumo da carteira (valores em reais):',
    JSON.stringify(summary, null, 2),
    '',
    'Responda somente JSON: {"insights":[{"title":"...","detail":"...","priority":"alta|media|baixa"}]}'
  ].join('\n')
}

export const adviceSchema = z.object({
  insights: z
    .array(
      z.object({
        title: z.string().min(1).max(120),
        detail: z.string().min(1).max(600),
        priority: z.enum(['alta', 'media', 'baixa'])
      })
    )
    .min(1)
    .max(8)
})

const adviceJsonSchema = {
  type: 'object',
  properties: {
    insights: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' },
          priority: { type: 'string', enum: ['alta', 'media', 'baixa'] }
        },
        required: ['title', 'detail', 'priority']
      }
    }
  },
  required: ['insights']
} as const

/** Pede as sugestões à IA. Resposta fora do formato vira erro: nada é inventado nem mostrado pela metade. */
export async function adviseInvestments(client: LLMClient, overview: InvestmentsOverview): Promise<InvestmentAdvice> {
  const raw = await client.generateJson(buildAdvicePrompt(buildPortfolioSummary(overview)), {
    jsonSchema: adviceJsonSchema,
    temperature: 0.3
  })
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    throw new Error('A IA respondeu em um formato inválido. Tente gerar de novo.')
  }
  const parsed = adviceSchema.safeParse(json)
  if (!parsed.success) throw new Error('A IA respondeu em um formato inválido. Tente gerar de novo.')
  return {
    insights: parsed.data.insights,
    generatedAt: new Date().toISOString(),
    provider: client.name,
    model: client.model
  }
}
