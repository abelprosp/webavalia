import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { evaluationRateLimiter } from '../middleware/rate-limit.js'
import { runPropertyEvaluation } from '../services/evaluation-service.js'
import { validatePhotos } from '../utils/photo-validation.js'
import {
  refundTrialEvaluation,
  reserveTrialEvaluation,
  TrialExhaustedError,
} from '../services/trial-service.js'
import {
  isEvaluationFeedbackModeEnabled,
  savePropertyEvaluation,
  submitEvaluationFeedback,
} from '../services/evaluation-feedback-service.js'
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
  standardLevel: z.enum(['padrao', 'alto-padrao', 'luxo']).default('padrao'),
  furnishing: z.enum(['sem', 'semi', 'completo']).default('sem'),
  finishLevel: z
    .enum(['basico', 'padrao', 'alto-padrao', 'luxo'])
    .default('padrao'),
  condominiumLevel: z
    .enum(['nao-aplica', 'padrao', 'alto-padrao', 'clube'])
    .default('nao-aplica'),
  viewType: z
    .enum(['nenhuma', 'cidade', 'mar', 'montanha', 'parque', 'lago'])
    .optional(),
  amenities: z.array(z.string()).default([]),
  askingPrice: z.number().optional(),
  notes: z.string().optional(),
  photos: z.array(photoSchema).max(5).optional(),
})

const feedbackSchema = z.object({
  evaluationId: z.uuid(),
  rating: z.enum(['good', 'bad']),
  comment: z.string().trim().min(10, 'Explique com ao menos 10 caracteres.').max(2000),
})

router.get('/config', requireAuth, async (_req, res) => {
  const feedbackModeEnabled = await isEvaluationFeedbackModeEnabled()
  return res.json({ feedbackModeEnabled })
})

router.post('/analyze', requireAuth, evaluationRateLimiter, async (req: AuthRequest, res) => {
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

  const photoValidation = validatePhotos(parsed.data.photos)
  if (!photoValidation.ok) {
    return res.status(400).json({ message: photoValidation.message })
  }

  const userId = req.user!.id
  let trialEvaluationsRemaining: number

  try {
    trialEvaluationsRemaining = await reserveTrialEvaluation(userId)
  } catch (error) {
    if (error instanceof TrialExhaustedError) {
      return res.status(403).json({
        message: error.message,
        trialEvaluationsRemaining: 0,
      })
    }
    throw error
  }

  try {
    const result = await runPropertyEvaluation(parsed.data)
    const feedbackModeEnabled = await isEvaluationFeedbackModeEnabled()

    let evaluationId: string | null = null
    if (feedbackModeEnabled) {
      evaluationId = await savePropertyEvaluation({
        userId,
        propertyInput: parsed.data,
        evaluationResult: result,
      })
    }

    return res.json({
      evaluation: result,
      evaluationId,
      feedbackModeEnabled,
      trialEvaluationsRemaining,
    })
  } catch (error) {
    await refundTrialEvaluation(userId)
    console.error('Erro na avaliação:', error)
    const message =
      error instanceof Error ? error.message : 'Erro ao processar avaliação.'
    return res.status(500).json({ message })
  }
})

router.post('/feedback', requireAuth, async (req: AuthRequest, res) => {
  const feedbackModeEnabled = await isEvaluationFeedbackModeEnabled()
  if (!feedbackModeEnabled) {
    return res.status(403).json({
      message: 'Modo de feedback temporário está desativado.',
    })
  }

  const parsed = feedbackSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
    })
  }

  try {
    await submitEvaluationFeedback({
      evaluationId: parsed.data.evaluationId,
      userId: req.user!.id,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
    })

    return res.status(201).json({
      message: 'Obrigado! Seu feedback ajuda a IA a melhorar nas próximas avaliações.',
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erro ao enviar feedback.'
    return res.status(400).json({ message })
  }
})

export default router
