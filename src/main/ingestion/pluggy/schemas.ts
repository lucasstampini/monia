import { z } from 'zod'

// Só validamos os campos que usamos; o resto da resposta é descartado.

export const authResponseSchema = z.object({ apiKey: z.string().min(1) })

export const itemSchema = z.object({
  id: z.string(),
  connector: z.object({ name: z.string() }),
  status: z.string().nullish()
})

export const accountSchema = z.object({
  id: z.string(),
  type: z.string(),
  subtype: z.string().nullish(),
  name: z.string(),
  marketingName: z.string().nullish(),
  creditData: z
    .object({
      balanceCloseDate: z.string().nullish(),
      balanceDueDate: z.string().nullish()
    })
    .nullish()
})

export const transactionSchema = z.object({
  id: z.string(),
  description: z.string(),
  descriptionRaw: z.string().nullish(),
  amount: z.number(),
  amountInAccountCurrency: z.number().nullish(),
  date: z.string(),
  type: z.enum(['DEBIT', 'CREDIT']),
  status: z.string().nullish(),
  category: z.string().nullish(),
  creditCardMetadata: z
    .object({
      installmentNumber: z.number().int().nullish(),
      totalInstallments: z.number().int().nullish(),
      billId: z.string().nullish()
    })
    .nullish()
})

export const billSchema = z.object({
  id: z.string(),
  dueDate: z.string(),
  totalAmount: z.number()
})

/** Listas paginadas da Pluggy. `results` é validado item a item no adaptador. */
export const pageSchema = z.object({
  results: z.array(z.unknown()),
  page: z.number().int().optional(),
  totalPages: z.number().int().optional()
})

export const investmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  subtype: z.string().nullish(),
  balance: z.number(),
  amountOriginal: z.number().nullish(),
  amountProfit: z.number().nullish(),
  lastMonthRate: z.number().nullish(),
  lastTwelveMonthsRate: z.number().nullish(),
  rate: z.number().nullish(),
  rateType: z.string().nullish(),
  fixedAnnualRate: z.number().nullish(),
  dueDate: z.string().nullish(),
  status: z.string().nullish(),
  date: z.string().nullish()
})

export type PluggyInvestment = z.infer<typeof investmentSchema>

/** Página do `GET /v2/transactions`: `next` é o link (ou cursor) da próxima página, null no fim. */
export const cursorPageSchema = z.object({
  results: z.array(z.unknown()),
  next: z.string().nullish()
})

export type PluggyItem = z.infer<typeof itemSchema>
export type PluggyAccount = z.infer<typeof accountSchema>
export type PluggyTransaction = z.infer<typeof transactionSchema>
export type PluggyBill = z.infer<typeof billSchema>
