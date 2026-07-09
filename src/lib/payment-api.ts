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
    paymentMethods: readonly ['CARD']
  }
  efi: {
    payeeCode: string
    environment: 'sandbox' | 'production'
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
  status: string
  subscriptionId: string
  chargeId: string | null
}

export type PlanCheckoutInput = {
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
