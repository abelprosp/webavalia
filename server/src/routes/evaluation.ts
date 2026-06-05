import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { runPropertyEvaluation } from '../services/evaluation-service.js'
import { config } from '../config.js'

const router = Router()

const photoSchema = z.object({
  mimeType: z.string().regex(/^image\/(jpeg|jpg|png|webp)$/),
  data: z.string().min(1),
})

const evaluationSchema = z.object({
  address: z.string().min(5),
  propertyType: z.string().min(1),
  area: z.number().min(10),
  bedrooms: z.number().min(0),
  bathrooms: z.number().min(0),
  parking: z.number().min(0),
  yearBuilt: z.number().min(1950).max(new Date().getFullYear()),
  conservation: z.string().min(1),
  askingPrice: z.number().optional(),
  location: z.number().min(1).max(5),
  infrastructure: z.number().min(1).max(5),
  condition: z.number().min(1).max(5),
  layout: z.number().min(1).max(5),
  market: z.number().min(1).max(5),
  documentation: z.number().min(1).max(5),
  notes: z.string().optional(),
  photos: z.array(photoSchema).max(5).optional(),
})

router.post('/analyze', requireAuth, async (req, res) => {
  if (!config.openaiApiKey) {
    return res.status(503).json({
      message:
        'Serviço de IA indisponível. Configure OPENAI_API_KEY no server/.env',
    })
  }

  const parsed = evaluationSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
    })
  }

  try {
    const result = await runPropertyEvaluation(parsed.data)
    return res.json({ evaluation: result })
  } catch (error) {
    console.error('Erro na avaliação:', error)
    const message =
      error instanceof Error ? error.message : 'Erro ao processar avaliação.'
    return res.status(500).json({ message })
  }
})

export default router
