import { api } from './api'

export type PaymentPricing = {
  leadCreditPack: {
    credits: number
    priceCents: number
    priceLabel: string
    label: string
    paymentMethods: readonly ['PIX']
  }
  evaluationPlan: {
    trialEvaluations: number
    priceCents: number
    priceLabel: string
    label: string
    description: string
    paymentMethods: readonly ['PIX', 'CARD']
  }
}

export type PixPaymentResponse = {
  orderId: string
  externalId: string
  credits: number
  amountCents: number
  brCode: string
  brCodeBase64: string
  expiresAt: string
  status: string
}

export type PlanCheckoutResponse = {
  orderId: string | null
  checkoutUrl: string
  amountCents: number
  trialEvaluations: number
  existingSubscription?: boolean
}

export async function fetchPaymentPricing() {
  const { data } = await api.get<PaymentPricing>('/payments/pricing')
  return data
}

export async function createLeadCreditsPix(input: {
  packs?: number
  cpfCnpj: string
}) {
  const { data } = await api.post<PixPaymentResponse>('/payments/credits/pix', {
    packs: input.packs,
    cpfCnpj: input.cpfCnpj,
  })
  return data
}

export async function pollLeadCreditsPixStatus(orderId: string) {
  const { data } = await api.get<{ status: string }>(
    `/payments/credits/pix/${orderId}/status`
  )
  return data
}

export async function createPlanCheckout(cpfCnpj: string) {
  const { data } = await api.post<PlanCheckoutResponse>(
    '/payments/plan/checkout',
    { cpfCnpj }
  )
  return data
}
