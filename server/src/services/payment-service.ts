import { randomUUID } from 'node:crypto'
import { pool } from '../db/pool.js'
import {
  calculatePixPackAmount,
  formatPriceLabel,
  getPlanBySlug,
  listPlans,
  PRICING,
  resolveCheckoutPlanSlug,
  type PlanAudience,
} from '../constants/pricing.js'
import {
  cancelCardSubscription,
  createCardSubscription,
  createPixCharge,
  ensureEvaluationPlanId,
  getChargeNotification,
  getEfiDiagnostics,
  getPixCharge,
  getPublicEfiConfig,
  pingEfiPixApi,
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
  subscription_plan_slug: string | null
  account_type: string
}

function mapPlanPublic(plan: ReturnType<typeof listPlans>[number]) {
  return {
    slug: plan.slug,
    audience: plan.audience,
    credits: plan.credits,
    priceCents: plan.priceCents,
    priceLabel: formatPriceLabel(plan.priceCents),
    label: plan.label,
    description: plan.description,
    highlighted: Boolean(plan.highlighted),
    features: plan.features,
    paymentMethods: ['CARD'] as const,
  }
}

export function getPublicPricing() {
  const pro = PRICING.plans.pro
  return {
    leadCreditPack: {
      credits: PRICING.leadCreditPack.credits,
      priceCents: PRICING.leadCreditPack.priceCents,
      priceLabel: formatPriceLabel(PRICING.leadCreditPack.priceCents),
      label: PRICING.leadCreditPack.label,
      allowedPacks: [5, 10, 20],
      pack20DiscountPercent: 10,
      paymentMethods: ['PIX'] as const,
    },
    plans: listPlans().map(mapPlanPublic),
    /** Compat: plano âncora Pro */
    evaluationPlan: {
      slug: pro.slug,
      trialEvaluations: pro.credits,
      priceCents: pro.priceCents,
      priceLabel: formatPriceLabel(pro.priceCents),
      label: `${pro.label} — ${pro.credits} créditos`,
      description: pro.description,
      paymentMethods: ['CARD'] as const,
    },
    costs: {
      evaluationCredits: 1,
      leadUnlockCredits: 2,
    },
    freeTier: {
      pfMonthlyEvaluations: 3,
      pfMonthlyPublishes: 1,
    },
    efi: getPublicEfiConfig(),
  }
}

export function getPaymentDiagnostics() {
  return getEfiDiagnostics()
}

export async function pingPaymentProvider() {
  return pingEfiPixApi()
}

async function getUserForPayment(userId: string) {
  const result = await pool.query<UserPaymentRow>(
    `SELECT id, name, email, company_name, efi_subscription_id,
            subscription_plan_slug, account_type
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
  const { packs, credits, amountCents } = calculatePixPackAmount(
    input.packs ?? 5
  )
  const orderId = randomUUID()
  const externalId = `lead-${orderId}`

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
    description: `${credits} crédito(s) — Avalia Imob`,
    orderId,
  })

  await pool.query(
    `UPDATE payment_orders
     SET abacate_id = $1,
         metadata = $2::jsonb
     WHERE id = $3`,
    [
      pix.txid,
      JSON.stringify({ provider: 'efi', txid: pix.txid }),
      orderId,
    ]
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
  planSlug?: string
}) {
  const user = await getUserForPayment(input.userId)
  if (!user) throw new Error('Usuário não encontrado.')

  if (user.efi_subscription_id) {
    throw new Error(
      'Você já possui uma assinatura ativa. Cancele a atual antes de assinar novamente.'
    )
  }

  const audience: PlanAudience =
    user.account_type === 'pf' ? 'pf' : 'pj'
  const planSlug = resolveCheckoutPlanSlug(input.planSlug, audience)
  const plan = PRICING.plans[planSlug]

  const orderId = randomUUID()
  const externalId = `plan-${orderId}`
  const amountCents = plan.priceCents
  const efiPlanId = await ensureEvaluationPlanId(planSlug)

  await pool.query(
    `INSERT INTO payment_orders
       (id, user_id, type, status, amount_cents, packs, external_id, metadata)
     VALUES ($1, $2, 'evaluation_plan', 'pending', $3, 1, $4, $5::jsonb)`,
    [
      orderId,
      input.userId,
      amountCents,
      externalId,
      JSON.stringify({
        provider: 'efi',
        planId: efiPlanId,
        planSlug,
        credits: plan.credits,
      }),
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
    planId: efiPlanId,
    amountCents,
    itemName: `Avalia Imob — ${plan.label}`,
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
        planSlug,
      }),
      orderId,
    ]
  )

  await pool.query(
    `UPDATE users
     SET efi_subscription_id = $2,
         subscription_plan_slug = $3,
         updated_at = NOW()
     WHERE id = $1`,
    [input.userId, subscriptionId, planSlug]
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
    trialEvaluations: plan.credits,
    planSlug,
    status: paid ? 'paid' : chargeStatus.toLowerCase(),
    subscriptionId,
    chargeId,
  }
}

export async function cancelEvaluationPlanSubscription(userId: string) {
  const user = await getUserForPayment(userId)
  if (!user) throw new Error('Usuário não encontrado.')

  if (!user.efi_subscription_id) {
    throw new Error('Você não possui uma assinatura ativa.')
  }

  const subscriptionId = Number(user.efi_subscription_id)
  if (!Number.isFinite(subscriptionId)) {
    throw new Error('Assinatura inválida. Entre em contato com o suporte.')
  }

  try {
    await cancelCardSubscription(subscriptionId)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error)
    // Já cancelada na Efí — limpa o vínculo local mesmo assim
    if (!/cancelad|canceled|cancelled|já|already/i.test(message)) {
      throw error instanceof Error
        ? error
        : new Error('Não foi possível cancelar a assinatura.')
    }
  }

  await pool.query(
    `UPDATE users
     SET efi_subscription_id = NULL,
         subscription_plan_slug = NULL,
         updated_at = NOW()
     WHERE id = $1`,
    [userId]
  )

  return { cancelled: true as const, subscriptionId: String(subscriptionId) }
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
         SET credits = credits + $2, updated_at = NOW()
         WHERE id = $1`,
        [order.user_id, credits]
      )
      await client.query(
        `INSERT INTO credit_transactions (user_id, amount, type, description)
         VALUES ($1, $2, 'purchase', $3)`,
        [
          order.user_id,
          credits,
          `Compra PIX — ${credits} crédito(s)`,
        ]
      )
    } else if (order.type === 'evaluation_plan') {
      const metaResult = await client.query<{
        metadata: { planSlug?: string; credits?: number } | null
      }>(`SELECT metadata FROM payment_orders WHERE id = $1`, [orderId])
      const meta = metaResult.rows[0]?.metadata
      const plan = getPlanBySlug(meta?.planSlug) ?? PRICING.plans.pro
      const credits = meta?.credits ?? plan.credits
      await client.query(
        `UPDATE users
         SET credits = credits + $2, updated_at = NOW()
         WHERE id = $1`,
        [order.user_id, credits]
      )
      await client.query(
        `INSERT INTO credit_transactions (user_id, amount, type, description)
         VALUES ($1, $2, 'purchase', $3)`,
        [
          order.user_id,
          credits,
          `Plano ${plan.label} — ${credits} crédito(s)`,
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

  const userResult = await pool.query<{
    id: string
    subscription_plan_slug: string | null
  }>(
    `SELECT id, subscription_plan_slug FROM users WHERE efi_subscription_id = $1`,
    [input.subscriptionId]
  )
  const user = userResult.rows[0]
  if (!user) {
    return { fulfilled: false, reason: 'user_not_found' as const }
  }

  const plan =
    getPlanBySlug(user.subscription_plan_slug) ?? PRICING.plans.pro
  const orderId = randomUUID()
  const externalId = `renewal-${input.paymentId}`
  const amountCents = plan.priceCents
  const credits = plan.credits

  await pool.query(
    `INSERT INTO payment_orders
       (id, user_id, type, status, amount_cents, packs, abacate_id, external_id, metadata, paid_at, fulfilled_at)
     VALUES ($1, $2, 'evaluation_plan', 'fulfilled', $3, 1, $4, $5, $6::jsonb, NOW(), NOW())
     ON CONFLICT (external_id) DO NOTHING`,
    [
      orderId,
      user.id,
      amountCents,
      input.subscriptionId,
      externalId,
      JSON.stringify({
        provider: 'efi',
        subscriptionId: input.subscriptionId,
        chargeId: input.paymentId,
        planSlug: plan.slug,
        credits: plan.credits,
        type: 'subscription_renewal',
      }),
    ]
  )

  await addTrialEvaluations(
    user.id,
    credits,
    `Renovação mensal — ${credits} crédito(s)`
  )

  return { fulfilled: true, userId: user.id, orderId }
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

export async function listMonthlyCharges(
  userId: string,
  limit = 24
): Promise<MonthlyCharge[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 100)

  const ordersResult = await pool.query<{
    id: string
    status: string
    amount_cents: number
    packs: number
    metadata: {
      type?: string
      planSlug?: string
      credits?: number
    } | null
    created_at: Date | string
    paid_at: Date | string | null
    fulfilled_at: Date | string | null
  }>(
    `SELECT id, status, amount_cents, packs, metadata, created_at, paid_at, fulfilled_at
     FROM payment_orders
     WHERE user_id = $1
       AND type = 'evaluation_plan'
       AND status IN ('paid', 'fulfilled', 'pending')
     ORDER BY COALESCE(paid_at, fulfilled_at, created_at) DESC
     LIMIT $2`,
    [userId, safeLimit]
  )

  const orderCharges: MonthlyCharge[] = ordersResult.rows.map((row) => {
    const isRenewal = row.metadata?.type === 'subscription_renewal'
    const plan = getPlanBySlug(row.metadata?.planSlug) ?? PRICING.plans.pro
    const chargedAt = row.paid_at ?? row.fulfilled_at ?? row.created_at
    return {
      id: row.id,
      kind: isRenewal ? 'renewal' : 'initial',
      label: isRenewal ? `Renovação — ${plan.label}` : plan.label,
      amountCents: row.amount_cents,
      credits: row.metadata?.credits ?? plan.credits * (row.packs || 1),
      status: row.status as MonthlyCharge['status'],
      chargedAt:
        chargedAt instanceof Date ? chargedAt.toISOString() : String(chargedAt),
    }
  })

  // Renovações antigas só existiam em credit_transactions (sem payment_order)
  const legacyResult = await pool.query<{
    id: string
    amount: number
    description: string | null
    created_at: Date | string
  }>(
    `SELECT ct.id, ct.amount, ct.description, ct.created_at
     FROM credit_transactions ct
     WHERE ct.user_id = $1
       AND ct.description ILIKE 'Renovação mensal%'
       AND NOT EXISTS (
         SELECT 1 FROM payment_orders o
         WHERE o.user_id = $1
           AND o.type = 'evaluation_plan'
           AND o.metadata->>'type' = 'subscription_renewal'
           AND ABS(
             EXTRACT(
               EPOCH FROM (
                 COALESCE(o.fulfilled_at, o.paid_at, o.created_at) - ct.created_at
               )
             )
           ) < 120
       )
     ORDER BY ct.created_at DESC
     LIMIT $2`,
    [userId, safeLimit]
  )

  const legacyCharges: MonthlyCharge[] = legacyResult.rows.map((row) => ({
    id: row.id,
    kind: 'renewal' as const,
    label: 'Renovação mensal',
    amountCents: PRICING.evaluationPlan.priceCents,
    credits: row.amount,
    status: 'fulfilled' as const,
    chargedAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  }))

  return [...orderCharges, ...legacyCharges]
    .sort(
      (a, b) =>
        new Date(b.chargedAt).getTime() - new Date(a.chargedAt).getTime()
    )
    .slice(0, safeLimit)
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

    if (order.status === 'fulfilled') {
      results.push({ txid: item.txid, orderId: order.id, alreadyFulfilled: true })
      continue
    }

    // Nunca confiar só no body do webhook — confirmar na API Efí.
    const paid = await verifyProviderPayment(order)
    if (!paid) {
      results.push({ txid: item.txid, orderId: order.id, reason: 'not_paid_on_provider' })
      continue
    }

    if (item.valor != null) {
      const webhookCents = Math.round(Number(item.valor) * 100)
      if (Number.isFinite(webhookCents) && webhookCents < order.amount_cents) {
        results.push({
          txid: item.txid,
          orderId: order.id,
          reason: 'amount_mismatch',
        })
        continue
      }
    }

    await markOrderPaid(order.id)
    await fulfillOrder(order.id)
    results.push({ txid: item.txid, orderId: order.id, processed: true })
  }

  return { processed: true, results }
}
