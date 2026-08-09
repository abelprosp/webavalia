import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { config } from '../config.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { requireBrokerAccount } from '../middleware/account-type.js'
import { createUserRateLimiter } from '../middleware/rate-limit.js'
import {
  generateApproachMessage,
  getCaptureOpportunity,
  listCaptureOpportunities,
  refundCreditForRadarScan,
  reserveCreditForRadarScan,
  runCaptureRadarScan,
  updateCaptureOpportunityStatus,
} from '../services/capture-radar-service.js'
import { createDealFromCaptureOpportunity } from '../services/crm-service.js'
import { CreditsExhaustedError } from '../services/trial-service.js'

const router = Router()

router.use(requireAuth, requireBrokerAccount)

const scanRateLimiter = createUserRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Limite de varreduras por hora atingido. Tente novamente mais tarde.',
})

const scanSchema = z.object({
  city: z.string().min(2).max(120),
  state: z.string().length(2),
  neighborhood: z.string().min(2).max(120).optional(),
  propertyType: z.string().min(1).max(60),
  listingIntent: z.enum(['vender', 'alugar']).default('vender'),
})

const statusSchema = z.object({
  status: z.enum(['nova', 'abordada', 'descartada']),
})

router.post('/scan', scanRateLimiter, async (req: AuthRequest, res) => {
  if (!config.serperApiKey) {
    return res.status(503).json({
      message: 'Serviço de busca indisponível. Configure SERPER_API_KEY.',
    })
  }

  const parsed = scanSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
    })
  }

  const userId = req.user!.id
  let creditsRemaining: number

  try {
    creditsRemaining = await reserveCreditForRadarScan(userId)
  } catch (error) {
    if (error instanceof CreditsExhaustedError) {
      return res.status(402).json({ message: error.message })
    }
    throw error
  }

  try {
    const result = await runCaptureRadarScan({
      userId,
      ...parsed.data,
    })
    return res.json({ ...result, creditsRemaining })
  } catch (error) {
    console.error('[radar/scan] falha na varredura:', error)
    await refundCreditForRadarScan(userId).catch((refundError) => {
      console.error('[radar/scan] falha no estorno:', refundError)
    })
    return res.status(502).json({
      message:
        'Falha na varredura. Seu crédito foi estornado — tente novamente.',
    })
  }
})

router.get('/opportunities', async (req: AuthRequest, res) => {
  const status =
    typeof req.query.status === 'string' && req.query.status
      ? req.query.status
      : undefined
  const search =
    typeof req.query.search === 'string' && req.query.search.trim()
      ? req.query.search.trim()
      : undefined

  const opportunities = await listCaptureOpportunities(req.user!.id, {
    status,
    search,
  })
  return res.json({ opportunities })
})

router.post('/opportunities/:id/approach', async (req: AuthRequest, res) => {
  try {
    const userRow = await pool.query<{ name: string }>(
      `SELECT name FROM users WHERE id = $1`,
      [req.user!.id]
    )
    const opportunity = await generateApproachMessage(
      req.user!.id,
      String(req.params.id),
      userRow.rows[0]?.name ?? null
    )
    return res.json({ opportunity })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Erro ao gerar mensagem de abordagem.'
    const status = message.includes('não encontrada') ? 404 : 502
    return res.status(status).json({ message })
  }
})

router.post('/opportunities/:id/to-crm', async (req: AuthRequest, res) => {
  const opportunity = await getCaptureOpportunity(
    req.user!.id,
    String(req.params.id)
  )
  if (!opportunity) {
    return res.status(404).json({ message: 'Oportunidade não encontrada.' })
  }

  if (opportunity.status === 'no_crm') {
    return res.status(409).json({ message: 'Oportunidade já está no CRM.' })
  }

  try {
    const deal = await createDealFromCaptureOpportunity(req.user!.id, opportunity)
    const updated = await updateCaptureOpportunityStatus(
      req.user!.id,
      opportunity.id,
      'no_crm'
    )
    return res.json({ deal, opportunity: updated })
  } catch (error) {
    console.error('[radar/to-crm] falha ao criar deal:', error)
    return res.status(500).json({ message: 'Erro ao adicionar ao CRM.' })
  }
})

router.patch('/opportunities/:id/status', async (req: AuthRequest, res) => {
  const parsed = statusSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.issues[0]?.message ?? 'Status inválido.',
    })
  }

  const opportunity = await updateCaptureOpportunityStatus(
    req.user!.id,
    String(req.params.id),
    parsed.data.status
  )
  if (!opportunity) {
    return res.status(404).json({ message: 'Oportunidade não encontrada.' })
  }
  return res.json({ opportunity })
})

export default router
