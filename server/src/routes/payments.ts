import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { pool } from '../db/pool.js'
import { USER_SELECT_FIELDS, type UserRow } from '../services/user-service.js'
import {
  cancelEvaluationPlanSubscription,
  createEvaluationPlanCheckout,
  createLeadCreditsPixOrder,
  getPaymentDiagnostics,
  getPublicPricing,
  listMonthlyCharges,
  pingPaymentProvider,
  syncLeadCreditsPixOrder,
} from '../services/payment-service.js'
import { paymentRateLimiter } from '../middleware/rate-limit.js'
import { requireBrokerAccount } from '../middleware/account-type.js'
import { requireAdmin } from '../middleware/roles.js'
import { CREDITS_AND_PLANS_ENABLED } from '../constants/feature-flags.js'
import type { NextFunction, Response } from 'express'

const router = Router()

function requireCreditsAndPlansEnabled(
  _req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  if (!CREDITS_AND_PLANS_ENABLED) {
    return res.status(503).json({
      message:
        'Compra de créditos e planos está temporariamente indisponível. Em breve.',
      code: 'CREDITS_AND_PLANS_DISABLED',
    })
  }
  return next()
}

router.get('/pricing', (_req, res) => {
  res.json({
    ...getPublicPricing(),
    purchasesEnabled: CREDITS_AND_PLANS_ENABLED,
  })
})

router.get(
  '/diagnostics',
  requireAuth,
  requireAdmin,
  (_req, res) => {
    res.json(getPaymentDiagnostics())
  }
)

router.get(
  '/diagnostics/pix',
  requireAuth,
  requireAdmin,
  async (_req, res) => {
    try {
      const result = await pingPaymentProvider()
      return res.status(result.ok ? 200 : 502).json({
        ...getPaymentDiagnostics(),
        ping: result,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Falha ao testar API Pix.'
      return res.status(502).json({
        ...getPaymentDiagnostics(),
        ping: { ok: false, error: message },
      })
    }
  }
)

router.use(requireAuth, paymentRateLimiter)

const cpfCnpjSchema = z
  .string()
  .trim()
  .min(11, 'Informe um CPF ou CNPJ válido.')
  .max(18)
  .transform((value) => value.replace(/\D/g, ''))
  .refine((value) => value.length === 11 || value.length === 14, {
    message: 'CPF ou CNPJ inválido.',
  })

const billingAddressSchema = z.object({
  street: z.string().trim().min(1, 'Informe a rua.').max(200),
  number: z.string().trim().min(1, 'Informe o número.').max(20),
  neighborhood: z.string().trim().min(1, 'Informe o bairro.').max(100),
  zipcode: z
    .string()
    .trim()
    .transform((value) => value.replace(/\D/g, ''))
    .refine((value) => value.length === 8, { message: 'CEP inválido.' }),
  city: z.string().trim().min(1, 'Informe a cidade.').max(100),
  state: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine((value) => /^[A-Z]{2}$/.test(value), {
      message: 'UF inválida.',
    }),
  complement: z.string().trim().max(100).optional(),
})

router.post(
  '/credits/pix',
  requireCreditsAndPlansEnabled,
  requireBrokerAccount,
  async (req: AuthRequest, res) => {
  const parsed = z
    .object({
      packs: z.union([z.literal(5), z.literal(10), z.literal(20)]).optional(),
      cpfCnpj: cpfCnpjSchema,
    })
    .safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
    })
  }

  const userResult = await pool.query<UserRow>(
    `SELECT ${USER_SELECT_FIELDS} FROM users WHERE id = $1`,
    [req.user!.id]
  )

  const user = userResult.rows[0]
  if (!user) {
    return res.status(404).json({ message: 'Usuário não encontrado.' })
  }

  try {
    const pix = await createLeadCreditsPixOrder({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      cpfCnpj: parsed.data.cpfCnpj,
      packs: parsed.data.packs,
    })

    return res.status(201).json(pix)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erro ao gerar cobrança PIX.'
    console.error('[payments/credits/pix]', message, error)
    return res.status(502).json({ message })
  }
  }
)

router.get('/credits/pix/:orderId/status', async (req: AuthRequest, res) => {
  const orderId = String(req.params.orderId)
  try {
    const result = await syncLeadCreditsPixOrder(orderId, req.user!.id)
    return res.json(result)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erro ao consultar pagamento.'
    return res.status(400).json({ message })
  }
})

router.post('/plan/checkout', requireCreditsAndPlansEnabled, async (req: AuthRequest, res) => {
  const parsed = z
    .object({
      planSlug: z
        .enum(['pf_plus', 'starter', 'pro', 'agency'])
        .optional(),
      cpfCnpj: cpfCnpjSchema,
      paymentToken: z.string().trim().min(10, 'Token de pagamento inválido.'),
      phoneNumber: z
        .string()
        .trim()
        .transform((value) => value.replace(/\D/g, ''))
        .refine((value) => value.length >= 10 && value.length <= 11, {
          message: 'Telefone inválido.',
        }),
      birth: z
        .string()
        .trim()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de nascimento inválida (AAAA-MM-DD).'),
      billingAddress: billingAddressSchema,
    })
    .safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
    })
  }

  try {
    const checkout = await createEvaluationPlanCheckout({
      userId: req.user!.id,
      planSlug: parsed.data.planSlug,
      cpfCnpj: parsed.data.cpfCnpj,
      paymentToken: parsed.data.paymentToken,
      phoneNumber: parsed.data.phoneNumber,
      birth: parsed.data.birth,
      billingAddress: parsed.data.billingAddress,
    })
    return res.status(201).json(checkout)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erro ao processar pagamento.'
    return res.status(502).json({ message })
  }
})

router.post('/plan/cancel', requireCreditsAndPlansEnabled, async (req: AuthRequest, res) => {
  try {
    const result = await cancelEvaluationPlanSubscription(req.user!.id)
    return res.json(result)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erro ao cancelar assinatura.'
    const status = /não possui|não encontrado/i.test(message) ? 400 : 502
    return res.status(status).json({ message })
  }
})

router.get('/plan/charges', async (req: AuthRequest, res) => {
  try {
    const charges = await listMonthlyCharges(req.user!.id)
    return res.json({ charges })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Erro ao carregar histórico de cobranças.'
    return res.status(500).json({ message })
  }
})

export default router
