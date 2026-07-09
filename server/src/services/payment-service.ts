import { randomUUID } from 'node:crypto'
import { pool } from '../db/pool.js'
import { PRICING } from '../constants/pricing.js'
import {
  createCardSubscription,
  createPixCharge,
  ensureEvaluationPlanId,
  getChargeNotification,
  getPixCharge,
  getPublicEfiConfig,
  isEfiChargePaid,
  isPixChargePaid,
  type EfiBillingAddress,
  type EfiCustomerInput,
} from './efi-service.js'
import { addTrialEvaluations } from './credits-service.js'

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

type UserPaymentRow = {
  id: string
  name: string
  email: string
  company_name: string | null
  efi_subscription_id: string | null
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
      paymentMethods: ['CARD'] as const,
    },
    efi: getPublicEfiConfig(),
  }
}

async function getUserForPayment(userId: string) {
  const result = await pool.query<UserPaymentRow>(
    `SELECT id, name, email, company_name, efi_subscription_id
     FROM users WHERE id = $1`,
    [userId]
  )
  return result.rows[0] ?? null
}

export async function createLeadCreditsPixOrder(input: {
  userId: string
  userName: string
  userEmail: string
  cpfCnpj: string
  packs?: number
}) {
  const packs = Math.min(Math.max(input.packs ?? 1, 1), 20)
  const orderId = randomUUID()
  const externalId = `lead-${orderId}`
  const amountCents = PRICING.leadCreditPack.priceCents * packs
  const credits = PRICING.leadCreditPack.credits * packs

  const user = await getUserForPayment(input.userId)
  if (!user) throw new Error('Usuário não encontrado.')

  await pool.query(
    `INSERT INTO payment_orders
       (id, user_id, type, status, amount_cents, packs, external_id)
     VALUES ($1, $2, 'lead_credits_pix', 'pending', $3, $4, $5)`,
    [orderId, input.userId, amountCents, packs, externalId]
  )

  const pix = await createPixCharge({
    amountCents,
    payerName: input.userName,
    cpfCnpj: input.cpfCnpj,
    description: `${credits} crédito(s) de leads — Avalia Imob`,
    orderId,
  })

  await pool.query(
    `UPDATE payment_orders
     SET abacate_id = $1,
         metadata = jsonb_build_object('provider', 'efi', 'txid', $1::text)
     WHERE id = $2`,
    [pix.txid, orderId]
  )

  return {
    orderId,
    externalId,
    credits,
    amountCents,
    brCode: pix.brCode,
    brCodeBase64: pix.brCodeBase64,
    expiresAt: pix.expiresAt,
    status: pix.status.toLowerCase(),
  }
}

export async function createEvaluationPlanCheckout(input: {
  userId: string
  cpfCnpj: string
  paymentToken: string
  phoneNumber: string
  birth: string
  billingAddress: EfiBillingAddress
}) {
  const user = await getUserForPayment(input.userId)
  if (!user) throw new Error('Usuário não encontrado.')

  if (user.efi_subscription_id) {
    throw new Error(
      'Você já possui uma assinatura ativa. Entre em contato se precisar de ajuda.'
    )
  }

  const orderId = randomUUID()
  const externalId = `plan-${orderId}`
  const amountCents = PRICING.evaluationPlan.priceCents
  const planId = await ensureEvaluationPlanId()

  await pool.query(
    `INSERT INTO payment_orders
       (id, user_id, type, status, amount_cents, packs, external_id, metadata)
     VALUES ($1, $2, 'evaluation_plan', 'pending', $3, 1, $4, $5::jsonb)`,
    [
      orderId,
      input.userId,
      amountCents,
      externalId,
      JSON.stringify({ provider: 'efi', planId }),
    ]
  )

  const customer: EfiCustomerInput = {
    name: user.name,
    email: user.email,
    cpfCnpj: input.cpfCnpj,
    phoneNumber: input.phoneNumber,
    birth: input.birth,
    companyName: user.company_name,
  }

  const subscription = await createCardSubscription({
    planId,
    amountCents,
    itemName: PRICING.evaluationPlan.label,
    customId: externalId,
    paymentToken: input.paymentToken,
    customer,
    billingAddress: input.billingAddress,
  })

  const chargeStatus = subscription.data.charge?.status ?? subscription.data.status
  const subscriptionId = String(subscription.data.subscription_id)
  const chargeId = subscription.data.charge?.id
    ? String(subscription.data.charge.id)
    : null

  await pool.query(
    `UPDATE payment_orders
     SET abacate_id = $1,
         metadata = metadata || $2::jsonb
     WHERE id = $3`,
    [
      subscriptionId,
      JSON.stringify({
        provider: 'efi',
        subscriptionId,
        chargeId,
        chargeStatus,
      }),
      orderId,
    ]
  )

  await pool.query(
    `UPDATE users
     SET efi_subscription_id = $2,
         updated_at = NOW()
     WHERE id = $1`,
    [input.userId, subscriptionId]
  )

  const paid =
    isEfiChargePaid(chargeStatus) ||
    chargeStatus.toLowerCase() === 'approved' ||
    subscription.data.status === 'active'

  if (paid) {
    await markOrderPaid(orderId)
    await fulfillOrder(orderId)
  }

  return {
    orderId,
    amountCents,
    trialEvaluations: PRICING.evaluationPlan.trialEvaluations,
    status: paid ? 'paid' : chargeStatus.toLowerCase(),
    subscriptionId,
    chargeId,
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
          `Compra PIX — ${credits} crédito(s) de leads`,
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

export async function fulfillSubscriptionRenewal(input: {
  paymentId: string
  subscriptionId: string
}) {
  const isNew = await registerWebhookEvent(
    `efi:renewal:${input.paymentId}`,
    'efi.subscription_renewal'
  )
  if (!isNew) {
    return { fulfilled: false, reason: 'duplicate' as const }
  }

  const userResult = await pool.query<{ id: string }>(
    `SELECT id FROM users WHERE efi_subscription_id = $1`,
    [input.subscriptionId]
  )
  const user = userResult.rows[0]
  if (!user) {
    return { fulfilled: false, reason: 'user_not_found' as const }
  }

  await addTrialEvaluations(
    user.id,
    PRICING.evaluationPlan.trialEvaluations,
    `Renovação mensal — ${PRICING.evaluationPlan.trialEvaluations} avaliações IA`
  )

  return { fulfilled: true, userId: user.id }
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

export async function findOrderBySubscriptionId(subscriptionId: string) {
  const result = await pool.query<PaymentOrderRow>(
    `SELECT id, user_id, type, status, amount_cents, packs, abacate_id, external_id
     FROM payment_orders
     WHERE abacate_id = $1 AND type = 'evaluation_plan'
     ORDER BY created_at DESC
     LIMIT 1`,
    [subscriptionId]
  )
  return result.rows[0] ?? null
}

export async function findOrderById(orderId: string, userId?: string) {
  const result = await pool.query<PaymentOrderRow>(
    userId
      ? `SELECT id, user_id, type, status, amount_cents, packs, abacate_id, external_id
         FROM payment_orders WHERE id = $1 AND user_id = $2`
      : `SELECT id, user_id, type, status, amount_cents, packs, abacate_id, external_id
         FROM payment_orders WHERE id = $1`,
    userId ? [orderId, userId] : [orderId]
  )
  return result.rows[0] ?? null
}

async function verifyProviderPayment(order: PaymentOrderRow) {
  if (!order.abacate_id) return false

  if (order.type === 'lead_credits_pix') {
    const charge = await getPixCharge(order.abacate_id)
    if (!isPixChargePaid(charge.status)) return false
    const paidCents = Math.round(
      Number(charge.pix?.[0]?.valor ?? charge.valor.original) * 100
    )
    return paidCents >= order.amount_cents
  }

  return false
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

  const paid = await verifyProviderPayment(order)
  if (paid) {
    await markOrderPaid(orderId)
    const result = await fulfillOrder(orderId)
    return {
      status: result.fulfilled ? ('fulfilled' as const) : ('paid' as const),
      order,
    }
  }

  const charge = await getPixCharge(order.abacate_id)
  return {
    status: charge.status.toLowerCase(),
    order,
  }
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

export async function handleEfiNotificationToken(token: string) {
  const notification = await getChargeNotification(token)
  const events = notification.data ?? []
  if (events.length === 0) {
    return { processed: false, reason: 'empty_notification' as const }
  }

  const last = events[events.length - 1]
  const eventKey = `efi:notification:${token}:${last.id}`
  const isNew = await registerWebhookEvent(eventKey, `efi.${last.status.current}`)
  if (!isNew) {
    return { processed: false, reason: 'duplicate' as const }
  }

  const status = last.status.current.toLowerCase()
  const customId = last.custom_id
  const chargeId = last.identifiers.charge_id
    ? String(last.identifiers.charge_id)
    : null
  const subscriptionId = last.identifiers.subscription_id
    ? String(last.identifiers.subscription_id)
    : null

  if (!isEfiChargePaid(status) && status !== 'approved') {
    return { processed: false, reason: 'ignored_status' as const, status }
  }

  if (customId?.startsWith('lead-')) {
    const order = await findOrderByExternalId(customId)
    if (!order) {
      return { processed: false, reason: 'order_not_found' as const }
    }
    await markOrderPaid(order.id)
    await fulfillOrder(order.id)
    return { processed: true, orderId: order.id, type: 'lead_credits_pix' }
  }

  if (customId?.startsWith('plan-')) {
    const order = await findOrderByExternalId(customId)
    if (order && order.status !== 'fulfilled') {
      await markOrderPaid(order.id)
      await fulfillOrder(order.id)
      return { processed: true, orderId: order.id, type: 'evaluation_plan' }
    }
  }

  if (subscriptionId) {
    const order = await findOrderBySubscriptionId(subscriptionId)
    if (order && order.status !== 'fulfilled') {
      await markOrderPaid(order.id)
      await fulfillOrder(order.id)
      return { processed: true, orderId: order.id, type: 'evaluation_plan' }
    }

    if (chargeId) {
      const renewal = await fulfillSubscriptionRenewal({
        paymentId: chargeId,
        subscriptionId,
      })
      if (renewal.fulfilled) {
        return {
          processed: true,
          type: 'subscription_renewal',
          userId: renewal.userId,
        }
      }
    }
  }

  return { processed: false, reason: 'unmatched_payment' as const }
}

export async function handlePixWebhookPayload(body: {
  pix?: Array<{ txid?: string; valor?: string; endToEndId?: string }>
}) {
  const items = body.pix ?? []
  if (items.length === 0) {
    return { processed: false, reason: 'no_pix' as const }
  }

  const results = []

  for (const item of items) {
    if (!item.txid) continue

    const eventId = `efi:pix:${item.endToEndId ?? item.txid}`
    const isNew = await registerWebhookEvent(eventId, 'efi.pix.received')
    if (!isNew) {
      results.push({ txid: item.txid, duplicate: true })
      continue
    }

    const orderResult = await pool.query<PaymentOrderRow>(
      `SELECT id, user_id, type, status, amount_cents, packs, abacate_id, external_id
       FROM payment_orders
       WHERE abacate_id = $1 AND type = 'lead_credits_pix'
       LIMIT 1`,
      [item.txid]
    )
    const order = orderResult.rows[0]
    if (!order) {
      results.push({ txid: item.txid, reason: 'order_not_found' })
      continue
    }

    await markOrderPaid(order.id)
    await fulfillOrder(order.id)
    results.push({ txid: item.txid, orderId: order.id, processed: true })
  }

  return { processed: true, results }
}
