import { randomUUID } from 'node:crypto'
import { pool } from '../db/pool.js'
import { PRICING } from '../constants/pricing.js'
import {
  createMonthlySubscription,
  createPixPayment,
  findOrCreateCustomer,
  getPayment,
  getPixQrCode,
  getSubscriptionPayments,
  isAsaasPaymentPaid,
} from './asaas-service.js'
import { addTrialEvaluations } from './credits-service.js'
import { config } from '../config.js'

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
  asaas_customer_id: string | null
  asaas_subscription_id: string | null
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

async function getUserForPayment(userId: string) {
  const result = await pool.query<UserPaymentRow>(
    `SELECT id, name, email, asaas_customer_id, asaas_subscription_id
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

  const customer = await findOrCreateCustomer({
    userId: input.userId,
    name: input.userName,
    email: input.userEmail,
    cpfCnpj: input.cpfCnpj,
    existingCustomerId: user.asaas_customer_id,
  })

  if (!user.asaas_customer_id) {
    await pool.query(
      `UPDATE users SET asaas_customer_id = $2, updated_at = NOW() WHERE id = $1`,
      [input.userId, customer.id]
    )
  }

  await pool.query(
    `INSERT INTO payment_orders
       (id, user_id, type, status, amount_cents, packs, external_id)
     VALUES ($1, $2, 'lead_credits_pix', 'pending', $3, $4, $5)`,
    [orderId, input.userId, amountCents, packs, externalId]
  )

  const payment = await createPixPayment({
    customerId: customer.id,
    amountCents,
    description: `${credits} crédito(s) de leads — Avalia Imob`,
    externalReference: externalId,
  })

  const qrCode = await getPixQrCode(payment.id)

  await pool.query(
    `UPDATE payment_orders SET abacate_id = $1 WHERE id = $2`,
    [payment.id, orderId]
  )

  return {
    orderId,
    externalId,
    credits,
    amountCents,
    brCode: qrCode.payload,
    brCodeBase64: qrCode.encodedImage,
    expiresAt: qrCode.expirationDate,
    status: payment.status.toLowerCase(),
  }
}

export async function createEvaluationPlanCheckout(input: {
  userId: string
  cpfCnpj: string
}) {
  const user = await getUserForPayment(input.userId)
  if (!user) throw new Error('Usuário não encontrado.')

  if (user.asaas_subscription_id) {
    const pendingPayment = await getSubscriptionPayments(
      user.asaas_subscription_id
    )
    if (pendingPayment?.invoiceUrl && !isAsaasPaymentPaid(pendingPayment.status)) {
      return {
        orderId: null,
        checkoutUrl: pendingPayment.invoiceUrl,
        amountCents: PRICING.evaluationPlan.priceCents,
        trialEvaluations: PRICING.evaluationPlan.trialEvaluations,
        existingSubscription: true,
      }
    }
  }

  const orderId = randomUUID()
  const externalId = `plan-${orderId}`
  const amountCents = PRICING.evaluationPlan.priceCents

  const customer = await findOrCreateCustomer({
    userId: input.userId,
    name: user.name,
    email: user.email,
    cpfCnpj: input.cpfCnpj,
    existingCustomerId: user.asaas_customer_id,
  })

  await pool.query(
    `INSERT INTO payment_orders
       (id, user_id, type, status, amount_cents, packs, external_id)
     VALUES ($1, $2, 'evaluation_plan', 'pending', $3, 1, $4)`,
    [orderId, input.userId, amountCents, externalId]
  )

  const subscription = await createMonthlySubscription({
    customerId: customer.id,
    amountCents,
    description: PRICING.evaluationPlan.label,
    externalReference: externalId,
  })

  const firstPayment = await getSubscriptionPayments(subscription.id)
  if (!firstPayment?.invoiceUrl) {
    throw new Error('Não foi possível gerar a fatura da assinatura.')
  }

  await pool.query(
    `UPDATE payment_orders SET abacate_id = $1 WHERE id = $2`,
    [subscription.id, orderId]
  )

  await pool.query(
    `UPDATE users
     SET asaas_customer_id = COALESCE(asaas_customer_id, $2),
         asaas_subscription_id = $3,
         updated_at = NOW()
     WHERE id = $1`,
    [input.userId, customer.id, subscription.id]
  )

  return {
    orderId,
    checkoutUrl: firstPayment.invoiceUrl,
    amountCents,
    trialEvaluations: PRICING.evaluationPlan.trialEvaluations,
    existingSubscription: false,
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
    `asaas:renewal:${input.paymentId}`,
    'asaas.subscription_renewal'
  )
  if (!isNew) {
    return { fulfilled: false, reason: 'duplicate' as const }
  }

  const userResult = await pool.query<{ id: string }>(
    `SELECT id FROM users WHERE asaas_subscription_id = $1`,
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
    const payment = await getPayment(order.abacate_id)
    return (
      isAsaasPaymentPaid(payment.status) &&
      Math.round(payment.value * 100) >= order.amount_cents
    )
  }

  const payments = await getSubscriptionPayments(order.abacate_id)
  if (!payments) return false

  return (
    isAsaasPaymentPaid(payments.status) &&
    Math.round(payments.value * 100) >= order.amount_cents
  )
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

  const payment = await getPayment(order.abacate_id)
  return {
    status: payment.status.toLowerCase(),
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

export async function handleAsaasWebhookPayload(body: {
  id: string
  event: string
  payment?: {
    id: string
    status: string
    externalReference?: string | null
    subscription?: string | null
    value?: number
  }
}) {
  const isNew = await registerWebhookEvent(`asaas:${body.id}`, body.event)
  if (!isNew) {
    return { processed: false, reason: 'duplicate' as const }
  }

  const payment = body.payment
  if (!payment?.id) {
    return { processed: false, reason: 'no_payment' as const }
  }

  if (
    body.event !== 'PAYMENT_RECEIVED' &&
    body.event !== 'PAYMENT_CONFIRMED'
  ) {
    return { processed: false, reason: 'ignored_event' as const }
  }

  if (!isAsaasPaymentPaid(payment.status)) {
    return { processed: false, reason: 'payment_not_confirmed' as const }
  }

  if (payment.externalReference?.startsWith('lead-')) {
    const order = await findOrderByExternalId(payment.externalReference)
    if (!order) {
      return { processed: false, reason: 'order_not_found' as const }
    }

    await markOrderPaid(order.id)
    await fulfillOrder(order.id)
    return { processed: true, orderId: order.id, type: 'lead_credits_pix' }
  }

  if (payment.subscription) {
    const order = await findOrderBySubscriptionId(payment.subscription)
    if (order && order.status !== 'fulfilled') {
      await markOrderPaid(order.id)
      await fulfillOrder(order.id)
      return { processed: true, orderId: order.id, type: 'evaluation_plan' }
    }

    const renewal = await fulfillSubscriptionRenewal({
      paymentId: payment.id,
      subscriptionId: payment.subscription,
    })
    if (renewal.fulfilled) {
      return {
        processed: true,
        type: 'subscription_renewal',
        userId: renewal.userId,
      }
    }
  }

  return { processed: false, reason: 'unmatched_payment' as const }
}
