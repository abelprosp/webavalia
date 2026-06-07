import crypto from 'node:crypto'
import { config } from '../config.js'
import { ABACATEPAY_PUBLIC_KEY } from '../constants/pricing.js'

const BASE_URL = 'https://api.abacatepay.com/v2'

type AbacateResponse<T> = {
  data: T | null
  success: boolean
  error: string | null
}

async function abacateRequest<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  if (!config.abacatePayApiKey) {
    throw new Error(
      'Pagamentos indisponíveis. Configure ABACATEPAY_API_KEY no server/.env'
    )
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${config.abacatePayApiKey}`,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const payload = (await response.json()) as AbacateResponse<T>

  if (!payload.success || !payload.data) {
    throw new Error(payload.error ?? 'Erro na AbacatePay.')
  }

  return payload.data
}

export type TransparentPixResponse = {
  id: string
  amount: number
  status: string
  brCode: string
  brCodeBase64: string
  expiresAt: string
}

export type CheckoutResponse = {
  id: string
  url: string
  amount: number
  status: string
  externalId: string | null
}

export type ProductResponse = {
  id: string
  externalId: string
  name: string
  price: number
}

export async function createTransparentPix(input: {
  amountCents: number
  description: string
  externalId: string
  customer: {
    name: string
    email: string
    taxId?: string
    cellphone?: string
  }
  metadata?: Record<string, string>
}) {
  return abacateRequest<TransparentPixResponse>('/transparents/create', {
    method: 'POST',
    body: {
      method: 'PIX',
      data: {
        amount: input.amountCents,
        description: input.description,
        expiresIn: 3600,
        customer: input.customer,
        metadata: {
          externalId: input.externalId,
          ...input.metadata,
        },
      },
    },
  })
}

export async function createCheckout(input: {
  productId: string
  externalId: string
  methods: Array<'PIX' | 'CARD'>
  completionUrl: string
  returnUrl: string
  metadata?: Record<string, string>
}) {
  return abacateRequest<CheckoutResponse>('/checkouts/create', {
    method: 'POST',
    body: {
      items: [{ id: input.productId, quantity: 1 }],
      externalId: input.externalId,
      methods: input.methods,
      completionUrl: input.completionUrl,
      returnUrl: input.returnUrl,
      metadata: input.metadata ?? {},
    },
  })
}

export async function createProduct(input: {
  externalId: string
  name: string
  priceCents: number
  description: string
  cycle?: 'MONTHLY'
}) {
  return abacateRequest<ProductResponse>('/products/create', {
    method: 'POST',
    body: {
      externalId: input.externalId,
      name: input.name,
      price: input.priceCents,
      currency: 'BRL',
      description: input.description,
      cycle: input.cycle ?? null,
    },
  })
}

export async function getTransparentStatus(id: string) {
  return abacateRequest<{ id: string; status: string }>(
    `/transparents/get?id=${encodeURIComponent(id)}`
  )
}

export function verifyWebhookSignature(
  rawBody: string,
  signatureFromHeader: string | undefined
) {
  if (!signatureFromHeader) return false

  const expectedSig = crypto
    .createHmac('sha256', ABACATEPAY_PUBLIC_KEY)
    .update(Buffer.from(rawBody, 'utf8'))
    .digest('base64')

  const expected = Buffer.from(expectedSig)
  const received = Buffer.from(signatureFromHeader)

  return (
    expected.length === received.length &&
    crypto.timingSafeEqual(expected, received)
  )
}

export function verifyWebhookSecret(querySecret: string | undefined) {
  if (!config.abacatePayWebhookSecret) return true
  return querySecret === config.abacatePayWebhookSecret
}
