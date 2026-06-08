import { timingSafeEqual } from 'node:crypto'
import { config } from '../config.js'

type AsaasErrorResponse = {
  errors?: Array<{ code: string; description: string }>
}

function getBaseUrl() {
  return config.asaas.environment === 'sandbox'
    ? 'https://api-sandbox.asaas.com/v3'
    : 'https://api.asaas.com/v3'
}

async function asaasRequest<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  if (!config.asaas.apiKey) {
    throw new Error(
      'Pagamentos indisponíveis. Configure ASAAS_API_KEY no server/.env'
    )
  }

  const response = await fetch(`${getBaseUrl()}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      access_token: config.asaas.apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'AvaliaImob/1.0',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const payload = (await response.json()) as T & AsaasErrorResponse

  if (!response.ok) {
    const message =
      payload.errors?.[0]?.description ??
      `Erro na API Asaas (${response.status}).`
    throw new Error(message)
  }

  return payload
}

export type AsaasCustomer = {
  id: string
  name: string
  email?: string
  cpfCnpj?: string
}

export type AsaasPayment = {
  id: string
  status: string
  value: number
  externalReference?: string | null
  invoiceUrl?: string | null
  subscription?: string | null
}

export type AsaasSubscription = {
  id: string
  status: string
  value: number
  customer: string
}

export type AsaasPixQrCode = {
  encodedImage: string
  payload: string
  expirationDate: string
}

function todayDueDate() {
  return new Date().toISOString().slice(0, 10)
}

function centsToValue(amountCents: number) {
  return Number((amountCents / 100).toFixed(2))
}

export async function findCustomerByExternalReference(externalReference: string) {
  const result = await asaasRequest<{ data: AsaasCustomer[] }>(
    `/customers?externalReference=${encodeURIComponent(externalReference)}&limit=1`
  )
  return result.data[0] ?? null
}

export async function createCustomer(input: {
  name: string
  email: string
  cpfCnpj: string
  externalReference: string
}) {
  return asaasRequest<AsaasCustomer>('/customers', {
    method: 'POST',
    body: {
      name: input.name,
      email: input.email,
      cpfCnpj: input.cpfCnpj.replace(/\D/g, ''),
      externalReference: input.externalReference,
      notificationDisabled: false,
    },
  })
}

export async function findOrCreateCustomer(input: {
  userId: string
  name: string
  email: string
  cpfCnpj: string
  existingCustomerId?: string | null
}) {
  if (input.existingCustomerId) {
    return { id: input.existingCustomerId }
  }

  const existing = await findCustomerByExternalReference(input.userId)
  if (existing) return existing

  return createCustomer({
    name: input.name,
    email: input.email,
    cpfCnpj: input.cpfCnpj,
    externalReference: input.userId,
  })
}

export async function createPixPayment(input: {
  customerId: string
  amountCents: number
  description: string
  externalReference: string
}) {
  return asaasRequest<AsaasPayment>('/payments', {
    method: 'POST',
    body: {
      customer: input.customerId,
      billingType: 'PIX',
      value: centsToValue(input.amountCents),
      dueDate: todayDueDate(),
      description: input.description,
      externalReference: input.externalReference,
    },
  })
}

export async function getPixQrCode(paymentId: string) {
  return asaasRequest<AsaasPixQrCode>(`/payments/${paymentId}/pixQrCode`)
}

export async function getPayment(paymentId: string) {
  return asaasRequest<AsaasPayment>(`/payments/${paymentId}`)
}

export async function createMonthlySubscription(input: {
  customerId: string
  amountCents: number
  description: string
  externalReference: string
}) {
  return asaasRequest<AsaasSubscription>('/subscriptions', {
    method: 'POST',
    body: {
      customer: input.customerId,
      billingType: 'UNDEFINED',
      value: centsToValue(input.amountCents),
      nextDueDate: todayDueDate(),
      cycle: 'MONTHLY',
      description: input.description,
      externalReference: input.externalReference,
    },
  })
}

export async function getSubscriptionPayments(subscriptionId: string) {
  const result = await asaasRequest<{ data: AsaasPayment[] }>(
    `/subscriptions/${subscriptionId}/payments?limit=1`
  )
  return result.data[0] ?? null
}

const PAID_STATUSES = new Set(['RECEIVED', 'CONFIRMED'])

export function isAsaasPaymentPaid(status: string) {
  return PAID_STATUSES.has(status.toUpperCase())
}

export function verifyAsaasWebhookToken(token: string | undefined) {
  if (!config.asaas.webhookToken) {
    return !config.isProduction
  }
  if (!token) return false

  const expected = Buffer.from(config.asaas.webhookToken)
  const received = Buffer.from(token)
  if (expected.length !== received.length) return false

  return timingSafeEqual(expected, received)
}
