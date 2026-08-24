import { api } from './api'

export type PlanPricing = {
  slug: 'pf_plus' | 'starter' | 'pro' | 'agency'
  audience: 'pf' | 'pj'
  credits: number
  priceCents: number
  priceLabel: string
  label: string
  description: string
  highlighted: boolean
  features: string[]
  paymentMethods: readonly ['CARD']
}

export type PaymentPricing = {
  leadCreditPack: {
    credits: number
    priceCents: number
    priceLabel: string
    label: string
    allowedPacks: number[]
    pack20DiscountPercent: number
    paymentMethods: readonly ['PIX']
  }
  plans: PlanPricing[]
  evaluationPlan: {
    slug: string
    trialEvaluations: number
    priceCents: number
    priceLabel: string
    label: string
    description: string
    paymentMethods: readonly ['CARD']
  }
  costs: {
    evaluationCredits: number
    leadUnlockCredits: number
  }
  freeTier: {
    pfMonthlyEvaluations: number
    pfMonthlyPublishes: number
  }
  efi: {
    payeeCode: string
    environment: 'sandbox' | 'production'
    pixReady: boolean
    certificateSource: 'env-base64' | 'file' | 'missing'
    cardReady: boolean
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
  orderId: string
  amountCents: number
  trialEvaluations: number
  planSlug?: string
  status: string
  subscriptionId: string
  chargeId: string | null
}

export type PlanCheckoutInput = {
  planSlug?: PlanPricing['slug']
  cpfCnpj: string
  paymentToken: string
  phoneNumber: string
  birth: string
  billingAddress: {
    street: string
    number: string
    neighborhood: string
    zipcode: string
    city: string
    state: string
    complement?: string
  }
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

export async function createPlanCheckout(input: PlanCheckoutInput) {
  const { data } = await api.post<PlanCheckoutResponse>(
    '/payments/plan/checkout',
    input
  )
  return data
}

export async function cancelPlanSubscription() {
  const { data } = await api.post<{
    cancelled: boolean
    subscriptionId: string
  }>('/payments/plan/cancel')
  return data
}

export type MonthlyCharge = {
  id: string
  kind: 'initial' | 'renewal'
  label: string
  amountCents: number
  credits: number
  status: 'paid' | 'pending' | 'fulfilled'
  chargedAt: string
}

export async function fetchMonthlyCharges() {
  const { data } = await api.get<{ charges: MonthlyCharge[] }>(
    '/payments/plan/charges'
  )
  return data.charges
}
