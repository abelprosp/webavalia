import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { requireBrokerAccount } from '../middleware/account-type.js'
import {
  completeTask,
  createDealFromEvaluation,
  createDealFromLead,
  getDealDetails,
  getPipelineBoard,
  listBrokerAssignees,
  moveDealStage,
  rescoreDeal,
  updateDeal,
  updateDealNotes,
} from '../services/crm-service.js'

const router = Router()

router.use(requireAuth, requireBrokerAccount)

router.get('/pipeline', async (req: AuthRequest, res) => {
  const board = await getPipelineBoard(req.user!.id)
  return res.json(board)
})

router.get('/assignees', async (_req: AuthRequest, res) => {
  const assignees = await listBrokerAssignees()
  return res.json({ assignees })
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

const fromEvaluationSchema = z.object({
  title: z.string().max(500).optional(),
  clientName: z.string().max(255).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  propertyInput: z.record(z.string(), z.unknown()),
  evaluationResult: z.record(z.string(), z.unknown()),
})

router.post('/deals/from-evaluation', async (req: AuthRequest, res) => {
  const parsed = fromEvaluationSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Dados da avaliação inválidos.' })
  }

  try {
    const deal = await createDealFromEvaluation(req.user!.id, {
      title: parsed.data.title,
      clientName: parsed.data.clientName,
      notes: parsed.data.notes,
      propertyInput: parsed.data.propertyInput,
      evaluationResult: parsed.data.evaluationResult,
    })
    return res.status(201).json({ deal })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erro ao salvar no CRM.'
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

const updateDealSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  clientName: z.string().max(255).nullable().optional(),
  clientPhone: z.string().max(50).nullable().optional(),
  clientEmail: z.union([z.string().email().max(255), z.literal('')]).nullable().optional(),
  location: z.string().max(500).nullable().optional(),
  propertyType: z.string().max(100).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  stageId: z.string().uuid().optional(),
  tags: z.array(z.string().max(100)).max(20).optional(),
  expectedTicket: z.number().min(0).nullable().optional(),
  leadScore: z
    .object({
      probability: z.number().min(0).max(100).optional(),
      urgency: z.enum(['baixa', 'media', 'alta']).optional(),
      expectedTicket: z.number().min(0).optional(),
      interest: z.string().max(500).optional(),
      summary: z.string().max(2000).optional(),
      tags: z.array(z.string().max(100)).max(20).optional(),
    })
    .optional(),
})

router.patch('/deals/:id', async (req: AuthRequest, res) => {
  const parsed = updateDealSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Dados inválidos.' })
  }

  try {
    const payload = {
      ...parsed.data,
      clientEmail:
        parsed.data.clientEmail === '' ? null : parsed.data.clientEmail,
    }
    const deal = await updateDeal(req.user!.id, String(req.params.id), payload)
    return res.json({ deal })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erro ao atualizar negócio.'
    return res.status(400).json({ message })
  }
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
