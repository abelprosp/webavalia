import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { requireBrokerAccount } from '../middleware/account-type.js'
import {
  completeTask,
  createDealFromLead,
  getDealDetails,
  getPipelineBoard,
  moveDealStage,
  rescoreDeal,
  updateDealNotes,
} from '../services/crm-service.js'

const router = Router()

router.use(requireAuth, requireBrokerAccount)

router.get('/pipeline', async (req: AuthRequest, res) => {
  const board = await getPipelineBoard(req.user!.id)
  return res.json(board)
})

router.get('/deals/:id', async (req: AuthRequest, res) => {
  const details = await getDealDetails(req.user!.id, String(req.params.id))
  if (!details) {
    return res.status(404).json({ message: 'Negócio não encontrado.' })
  }
  return res.json(details)
})

router.post('/deals/from-lead/:leadId', async (req: AuthRequest, res) => {
  try {
    const deal = await createDealFromLead(req.user!.id, String(req.params.leadId))
    return res.status(201).json({ deal })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erro ao criar negócio.'
    return res.status(400).json({ message })
  }
})

const moveSchema = z.object({
  stageId: z.string().uuid(),
})

router.patch('/deals/:id/stage', async (req: AuthRequest, res) => {
  const parsed = moveSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Etapa inválida.' })
  }

  try {
    const deal = await moveDealStage(
      req.user!.id,
      String(req.params.id),
      parsed.data.stageId
    )
    return res.json({ deal })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erro ao mover negócio.'
    return res.status(400).json({ message })
  }
})

router.post('/deals/:id/score', async (req: AuthRequest, res) => {
  try {
    const deal = await rescoreDeal(req.user!.id, String(req.params.id))
    return res.json({ deal })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erro ao pontuar lead.'
    return res.status(400).json({ message })
  }
})

const notesSchema = z.object({
  notes: z.string().max(5000),
})

router.patch('/deals/:id/notes', async (req: AuthRequest, res) => {
  const parsed = notesSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Notas inválidas.' })
  }

  await updateDealNotes(req.user!.id, String(req.params.id), parsed.data.notes)
  return res.json({ message: 'Notas atualizadas.' })
})

router.patch('/tasks/:id/complete', async (req: AuthRequest, res) => {
  try {
    await completeTask(req.user!.id, String(req.params.id))
    return res.json({ message: 'Tarefa concluída.' })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erro ao concluir tarefa.'
    return res.status(400).json({ message })
  }
})

export default router
