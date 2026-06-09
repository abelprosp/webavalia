import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { requireBrokerAccount } from '../middleware/account-type.js'
import {
  getLeadForUser,
  listLeadsForUser,
  unlockLeadForUser,
  updateLeadStatus,
} from '../services/lead-service.js'

const router = Router()

router.use(requireAuth, requireBrokerAccount)

const statusSchema = z.object({
  status: z.enum(['novo', 'contatado']),
})

router.get('/', async (req: AuthRequest, res) => {
  const leads = await listLeadsForUser(req.user!.id)
  return res.json({ leads })
})

router.get('/:id', async (req: AuthRequest, res) => {
  const lead = await getLeadForUser(req.user!.id, String(req.params.id))
  if (!lead) {
    return res.status(404).json({ message: 'Lead não encontrado.' })
  }
  return res.json({ lead })
})

router.post('/:id/unlock', async (req: AuthRequest, res) => {
  try {
    const result = await unlockLeadForUser(req.user!.id, String(req.params.id))
    return res.json(result)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erro ao desbloquear lead.'
    const status = message.includes('insuficientes') ? 402 : 404
    return res.status(status).json({ message })
  }
})

router.patch('/:id/status', async (req: AuthRequest, res) => {
  const parsed = statusSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.issues[0]?.message ?? 'Status inválido.',
    })
  }

  const lead = await getLeadForUser(req.user!.id, String(req.params.id))
  if (!lead) {
    return res.status(404).json({ message: 'Lead não encontrado.' })
  }

  if (!lead.unlocked) {
    return res.status(403).json({
      message: 'Desbloqueie o lead antes de atualizar o status.',
    })
  }

  try {
    await updateLeadStatus(String(req.params.id), parsed.data.status)
    const updated = await getLeadForUser(req.user!.id, String(req.params.id))
    return res.json({ lead: updated })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erro ao atualizar status.'
    return res.status(404).json({ message })
  }
})

export default router
