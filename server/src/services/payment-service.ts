import { randomUUID } from 'node:crypto'
import { pool } from '../db/pool.js'
import { PRICING } from '../constants/pricing.js'
import {
  createCheckout,
  createProduct,
  createTransparentPix,
  getTransparentStatus,
} from './abacatepay-service.js'
import { config } from '../config.js'

const PLAN_PRODUCT_KEY = 'abacate_plan_product_id'
const PLAN_EXTERNAL_ID = 'avalia-plano-mensal-50'

type PaymentOrderRow = {
  id: string
  user_id: string
  type: 'lead_credits_pix' | 'evaluation_plan'
  status: string
  amount_cents: number
  packs: number
  abacate_id: string | null
  external_id: string
}

async function getSettingValue(key: string): Promise<string | null> {
  const result = await pool.query<{ value: unknown }>(
    'SELECT value FROM platform_settings WHERE key = $1',
    [key]
  )

  if (!result.rowCount) return null

  const raw = result.rows[0].value
  if (typeof raw === 'object' && raw !== null && 'productId' in raw) {
    return String((raw as { productId: string }).productId)
  }

  return null
}

async function saveSettingValue(key: string, productId: string) {
  await pool.query(
    `INSERT INTO platform_settings (key, value, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE
     SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, JSON.stringify({ productId })]
  )
}

export async function ensurePlanProductId() {
  const fromEnv = process.env.ABACATEPAY_PLAN_PRODUCT_ID
  if (fromEnv) return fromEnv

  const cached = await getSettingValue(PLAN_PRODUCT_KEY)
  if (cached) return cached

  const product = await createProduct({
    externalId: PLAN_EXTERNAL_ID,
    name: PRICING.evaluationPlan.label,
    priceCents: PRICING.evaluationPlan.priceCents,
    description: PRICING.evaluationPlan.description,
    cycle: 'MONTHLY',
  })

  await saveSettingValue(PLAN_PRODUCT_KEY, product.id)
  return product.id
}

export function getPublicPricing() {
  return {
    leadCreditPack: {
      credits: PRICING.leadCreditPack.credits,
      priceCents: PRICING.leadCreditPack.priceCents,
      priceLabel: (PRICING.leadCreditPack.priceCents / 100).toLocaleString(
        'pt-BR',
        { style: 'currency', currency: 'BRL' }
      ),
      label: PRICING.leadCreditPack.label,
      paymentMethods: ['PIX'] as const,
    },
    evaluationPlan: {
      trialEvaluations: PRICING.evaluationPlan.trialEvaluations,
      priceCents: PRICING.evaluationPlan.priceCents,
      priceLabel: (PRICING.evaluationPlan.priceCents / 100).toLocaleString(
        'pt-BR',
        { style: 'currency', currency: 'BRL' }
      ),
      label: PRICING.evaluationPlan.label,
      description: PRICING.evaluationPlan.description,
      paymentMethods: ['PIX', 'CARD'] as const,
    },
  }
}

export async function createLeadCreditsPixOrder(input: {
  userId: string
  userName: string
  userEmail: string
  packs?: number
}) {
  const packs = Math.min(Math.max(input.packs ?? 1, 1), 20)
  const orderId = randomUUID()
  const externalId = `lead-${orderId}`
  const amountCents = PRICING.leadCreditPack.priceCents * packs
  const credits = PRICING.leadCreditPack.credits * packs

  await pool.query(
    `INSERT INTO payment_orders
       (id, user_id, type, status, amount_cents, packs, external_id)
     VALUES ($1, $2, 'lead_credits_pix', 'pending', $3, $4, $5)`,
    [orderId, input.userId, amountCents, packs, externalId]
  )

  const pix = await createTransparentPix({
    amountCents,
    description: `${credits} créditos de leads — Avalia Imob`,
    externalId,
    customer: {
      name: input.userName,
      email: input.userEmail,
    },
    metadata: {
      orderId,
      userId: input.userId,
      type: 'lead_credits_pix',
      packs: String(packs),
    },
  })

  await pool.query(
    `UPDATE payment_orders SET abacate_id = $1 WHERE id = $2`,
    [pix.id, orderId]
  )

  return {
    orderId,
    externalId,
    credits,
    amountCents,
    brCode: pix.brCode,
    brCodeBase64: pix.brCodeBase64,
    expiresAt: pix.expiresAt,
    status: pix.status,
  }
}

export async function createEvaluationPlanCheckout(input: {
  userId: string
}) {
  const productId = await ensurePlanProductId()
  const orderId = randomUUID()
  const externalId = `plan-${orderId}`
  const amountCents = PRICING.evaluationPlan.priceCents
  const returnBase = `${config.appUrl}/settings/credits`

  await pool.query(
    `INSERT INTO payment_orders
       (id, user_id, type, status, amount_cents, packs, external_id)
     VALUES ($1, $2, 'evaluation_plan', 'pending', $3, 1, $4)`,
    [orderId, input.userId, amountCents, externalId]
  )

  const checkout = await createCheckout({
    productId,
    externalId,
    methods: ['PIX', 'CARD'],
    completionUrl: `${returnBase}?payment=success&order=${orderId}`,
    returnUrl: `${returnBase}?payment=cancelled`,
    metadata: {
      orderId,
      userId: input.userId,
      type: 'evaluation_plan',
    },
  })

  await pool.query(
    `UPDATE payment_orders SET abacate_id = $1 WHERE id = $2`,
    [checkout.id, orderId]
  )

  return {
    orderId,
    checkoutUrl: checkout.url,
    amountCents,
    trialEvaluations: PRICING.evaluationPlan.trialEvaluations,
  }
}

export async function fulfillOrder(orderId: string) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const orderResult = await client.query<PaymentOrderRow>(
      `SELECT id, user_id, type, status, amount_cents, packs, abacate_id, external_id
       FROM payment_orders
       WHERE id = $1
       FOR UPDATE`,
      [orderId]
    )

    const order = orderResult.rows[0]
    if (!order) {
      await client.query('ROLLBACK')
      return { fulfilled: false, reason: 'not_found' as const }
    }

    if (order.status === 'fulfilled') {
      await client.query('COMMIT')
      return { fulfilled: false, reason: 'already_fulfilled' as const }
    }

    if (order.type === 'lead_credits_pix') {
      const credits = PRICING.leadCreditPack.credits * order.packs
      await client.query(
        `UPDATE users
         SET lead_credits = lead_credits + $2, updated_at = NOW()
         WHERE id = $1`,
        [order.user_id, credits]
      )
      await client.query(
        `INSERT INTO credit_transactions (user_id, amount, type, description)
         VALUES ($1, $2, 'purchase', $3)`,
        [
          order.user_id,
          credits,
          `Compra PIX — ${credits} créditos de leads`,
        ]
      )
    } else if (order.type === 'evaluation_plan') {
      await client.query(
        `UPDATE users
         SET trial_evaluations_remaining = trial_evaluations_remaining + $2,
             updated_at = NOW()
         WHERE id = $1`,
        [order.user_id, PRICING.evaluationPlan.trialEvaluations]
      )
      await client.query(
        `INSERT INTO credit_transactions (user_id, amount, type, description)
         VALUES ($1, $2, 'evaluation_purchase', $3)`,
        [
          order.user_id,
          PRICING.evaluationPlan.trialEvaluations,
          `Plano mensal — ${PRICING.evaluationPlan.trialEvaluations} avaliações IA`,
        ]
      )
    }

    await client.query(
      `UPDATE payment_orders
       SET status = 'fulfilled', paid_at = NOW(), fulfilled_at = NOW()
       WHERE id = $1`,
      [orderId]
    )

    await client.query('COMMIT')
    return { fulfilled: true, order }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function markOrderPaid(orderId: string) {
  await pool.query(
    `UPDATE payment_orders
     SET status = 'paid', paid_at = COALESCE(paid_at, NOW())
     WHERE id = $1 AND status = 'pending'`,
    [orderId]
  )
}

export async function findOrderByExternalId(externalId: string) {
  const result = await pool.query<PaymentOrderRow>(
    `SELECT id, user_id, type, status, amount_cents, packs, abacate_id, external_id
     FROM payment_orders
     WHERE external_id = $1`,
    [externalId]
  )
  return result.rows[0] ?? null
}

export async function findOrderById(orderId: string, userId?: string) {
  const result = await pool.query<PaymentOrderRow & { status: string }>(
    userId
      ? `SELECT id, user_id, type, status, amount_cents, packs, abacate_id, external_id
         FROM payment_orders WHERE id = $1 AND user_id = $2`
      : `SELECT id, user_id, type, status, amount_cents, packs, abacate_id, external_id
         FROM payment_orders WHERE id = $1`,
    userId ? [orderId, userId] : [orderId]
  )
  return result.rows[0] ?? null
}

export async function syncLeadCreditsPixOrder(orderId: string, userId: string) {
  const order = await findOrderById(orderId, userId)
  if (!order || order.type !== 'lead_credits_pix') {
    throw new Error('Pedido não encontrado.')
  }

  if (order.status === 'fulfilled') {
    return { status: 'fulfilled' as const, order }
  }

  if (!order.abacate_id) {
    return { status: order.status as 'pending', order }
  }

  const transparent = await getTransparentStatus(order.abacate_id)
  if (transparent.status === 'PAID') {
    await markOrderPaid(orderId)
    const result = await fulfillOrder(orderId)
    return {
      status: result.fulfilled ? ('fulfilled' as const) : ('paid' as const),
      order,
    }
  }

  return { status: transparent.status.toLowerCase() as string, order }
}

export async function registerWebhookEvent(eventId: string, eventType: string) {
  const inserted = await pool.query(
    `INSERT INTO webhook_events (id, event_type)
     VALUES ($1, $2)
     ON CONFLICT (id) DO NOTHING
     RETURNING id`,
    [eventId, eventType]
  )
  return Boolean(inserted.rowCount)
}

export async function handleWebhookPayload(body: {
  id: string
  event: string
  data: {
    transparent?: { externalId?: string | null; status?: string }
    checkout?: { externalId?: string | null; status?: string }
  }
}) {
  const isNew = await registerWebhookEvent(body.id, body.event)
  if (!isNew) {
    return { processed: false, reason: 'duplicate' as const }
  }

  const externalId =
    body.data.transparent?.externalId ?? body.data.checkout?.externalId

  if (!externalId) {
    return { processed: false, reason: 'no_external_id' as const }
  }

  const order = await findOrderByExternalId(externalId)
  if (!order) {
    return { processed: false, reason: 'order_not_found' as const }
  }

  if (
    body.event === 'transparent.completed' ||
    body.event === 'checkout.completed' ||
    body.event === 'subscription.completed' ||
    body.event === 'subscription.renewed'
  ) {
    await markOrderPaid(order.id)
    await fulfillOrder(order.id)
    return { processed: true, orderId: order.id }
  }

  return { processed: false, reason: 'ignored_event' as const }
}
