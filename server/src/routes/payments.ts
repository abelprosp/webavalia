import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { pool } from '../db/pool.js'
import { USER_SELECT_FIELDS, type UserRow } from '../services/user-service.js'
import {
  createEvaluationPlanCheckout,
  createLeadCreditsPixOrder,
  getPublicPricing,
  syncLeadCreditsPixOrder,
} from '../services/payment-service.js'

const router = Router()

router.get('/pricing', (_req, res) => {
  res.json(getPublicPricing())
})

router.use(requireAuth)

router.post('/credits/pix', async (req: AuthRequest, res) => {
  const parsed = z
    .object({
      packs: z.number().int().min(1).max(20).optional(),
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
      packs: parsed.data.packs,
    })

    return res.status(201).json(pix)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erro ao gerar cobrança PIX.'
    return res.status(502).json({ message })
  }
})

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

router.post('/plan/checkout', async (req: AuthRequest, res) => {
  try {
    const checkout = await createEvaluationPlanCheckout({
      userId: req.user!.id,
    })
    return res.status(201).json(checkout)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erro ao iniciar checkout.'
    return res.status(502).json({ message })
  }
})

export default router
