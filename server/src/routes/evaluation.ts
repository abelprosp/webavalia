import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { requireBrokerAccount } from '../middleware/account-type.js'
import {
  createUserRateLimiter,
  evaluationRateLimiter,
} from '../middleware/rate-limit.js'
import { MARKET_MAP_EVALUATION_DEFAULTS, MARKET_MAP_DEFAULT_AREA, isLandOnlyPropertyType } from '../constants/evaluation-defaults.js'
import { runPropertyEvaluation } from '../services/evaluation-service.js'
import {
  composeMarketMapAddress,
  reverseGeocode,
  searchCities,
  geocodeCep,
} from '../services/geocoding-service.js'
import { resolveMarketMapPricing } from '../utils/market-map-pricing.js'
import { validatePhotos } from '../utils/photo-validation.js'
import {
  refundTrialEvaluation,
  reserveTrialEvaluation,
  TrialExhaustedError,
} from '../services/trial-service.js'
import {
  grantPfEvaluationReward,
  grantPfPublishReward,
  recordPfEvaluationUsage,
  revertPfEvaluationUsage,
} from '../services/pf-credits-service.js'
import {
  isEvaluationFeedbackModeEnabled,
  publishEvaluationAsLead,
  savePropertyEvaluation,
  submitEvaluationFeedback,
} from '../services/evaluation-feedback-service.js'
import {
  mapAchievementForResponse,
  processEvaluationGamification,
  processFeedbackGamification,
} from '../services/gamification-service.js'
import { config } from '../config.js'
import { BUILDING_AGE_VALUES } from '../constants/building-age.js'

const router = Router()

const marketMapRateLimiter = createUserRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: 'Limite de consultas no mapa por hora atingido. Tente novamente mais tarde.',
})

const marketMapSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  city: z.string().min(2),
  state: z.string().length(2),
  propertyType: z.string().min(1),
  bedrooms: z.number().min(0).optional(),
  area: z.number().min(0),
  listingIntent: z.enum(['alugar', 'vender']).default('vender'),
})

const photoSchema = z.object({
  mimeType: z.string().regex(/^image\/(jpeg|jpg|png|webp)$/),
  data: z.string().min(1),
})

const evaluationSchema = z.object({
  cep: z.union([z.literal(''), z.string().regex(/^\d{5}-?\d{3}$/)]).optional(),
  streetNumber: z.string().optional(),
  address: z.string().min(5),
  propertyType: z.string().min(1),
  area: z.number().min(10),
  lotArea: z.number().min(10).optional(),
  bedrooms: z.number().min(0),
  bathrooms: z.number().min(0),
  parking: z.number().min(0),
  buildingAge: z.enum(BUILDING_AGE_VALUES),
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
  listingIntent: z.enum(['alugar', 'vender']).default('vender'),
  highEndFurnitureValue: z.number().min(1).optional(),
  askingPrice: z.number().optional(),
  notes: z.string().optional(),
  photos: z.array(photoSchema).max(5).optional(),
}).superRefine((data, ctx) => {
  if (
    data.amenities.includes('moveis-alto-padrao') &&
    data.highEndFurnitureValue == null
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['highEndFurnitureValue'],
      message: 'Informe o valor estimado de todos os móveis juntos.',
    })
  }
})

const feedbackSchema = z.object({
  evaluationId: z.uuid(),
  rating: z.enum(['good', 'bad']),
  comment: z.string().trim().min(10, 'Explique com ao menos 10 caracteres.').max(2000),
})

const publishLeadSchema = z.object({
  evaluationId: z.uuid(),
  phone: z
    .string()
    .transform((value) => value.replace(/\D/g, ''))
    .refine((value) => value.length >= 10 && value.length <= 11, {
      message: 'Informe um telefone válido com DDD.',
    }),
  consent: z.literal(true, {
    error: 'É necessário autorizar o compartilhamento dos dados.',
  }),
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
  const isPfAccount = req.user!.accountType === 'pf'
  let trialEvaluationsRemaining: number

  try {
    if (isPfAccount) {
      trialEvaluationsRemaining = await recordPfEvaluationUsage(userId)
    } else {
      trialEvaluationsRemaining = await reserveTrialEvaluation(userId)
    }
  } catch (error) {
    if (error instanceof TrialExhaustedError) {
      return res.status(403).json({
        message: error.message,
        credits: 0,
        trialEvaluationsRemaining: 0,
      })
    }
    throw error
  }

  try {
    const result = await runPropertyEvaluation(parsed.data)
    const feedbackModeEnabled = await isEvaluationFeedbackModeEnabled()

    const evaluationId = await savePropertyEvaluation({
      userId,
      propertyInput: parsed.data,
      evaluationResult: result,
    })

    const gamification = await processEvaluationGamification(userId)

    let pfCreditsEarned = 0
    let credits =
      gamification.trialEvaluationsRemaining ?? trialEvaluationsRemaining

    if (isPfAccount) {
      const pfReward = await grantPfEvaluationReward(userId, evaluationId)
      pfCreditsEarned = pfReward.amount
      credits = pfReward.credits
    }

    return res.json({
      evaluation: result,
      evaluationId,
      feedbackModeEnabled,
      credits,
      trialEvaluationsRemaining: credits,
      pfCreditsEarned: isPfAccount ? pfCreditsEarned : undefined,
      gamification: {
        level: gamification.level,
        monthlyGoalCompleted: gamification.monthlyGoalCompleted,
        achievementTrialReward: gamification.achievementTrialReward,
        credits: gamification.trialEvaluationsRemaining ?? credits,
        trialEvaluationsRemaining: gamification.trialEvaluationsRemaining ?? credits,
        newAchievements: gamification.newAchievements.map(mapAchievementForResponse),
      },
    })
  } catch (error) {
    if (isPfAccount) {
      await revertPfEvaluationUsage(userId)
    } else {
      await refundTrialEvaluation(userId)
    }
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

    const gamification = await processFeedbackGamification(req.user!.id)

    const totalReward = gamification.reward.trialEvaluations
    let message = 'Obrigado! Seu feedback ajuda a IA a melhorar nas próximas avaliações.'
    if (totalReward > 0) {
      message = `Obrigado! Você ganhou +${totalReward} avaliação(ões) bônus.`
    }

    return res.status(201).json({
      message,
      reward: gamification.reward,
      gamification: {
        level: gamification.level,
        monthlyGoalCompleted: gamification.monthlyGoalCompleted,
        achievementTrialReward: gamification.achievementTrialReward,
        trialEvaluationsRemaining: gamification.trialEvaluationsRemaining,
        newAchievements: gamification.newAchievements.map(mapAchievementForResponse),
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erro ao enviar feedback.'
    return res.status(400).json({ message })
  }
})

router.get(
  '/market-map/cities',
  requireAuth,
  requireBrokerAccount,
  async (req: AuthRequest, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    if (query.length < 2) {
      return res.json([])
    }

    try {
      const cities = await searchCities(query)
      return res.json(cities)
    } catch {
      return res.status(502).json({ message: 'Falha ao buscar cidades.' })
    }
  }
)

router.get(
  '/market-map/cep/:cep',
  requireAuth,
  requireBrokerAccount,
  async (req: AuthRequest, res) => {
    try {
      const location = await geocodeCep(String(req.params.cep))
      return res.json(location)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Falha ao localizar CEP.'
      const status = message.includes('não encontrado') ? 404 : 400
      return res.status(status).json({ message })
    }
  }
)

router.post(
  '/market-map',
  requireAuth,
  requireBrokerAccount,
  marketMapRateLimiter,
  async (req: AuthRequest, res) => {
    if (!config.openaiApiKey) {
      return res.status(503).json({
        message:
          'Serviço de IA indisponível. Configure OPENAI_API_KEY no server/.env',
      })
    }

    const parsed = marketMapSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        message: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
      })
    }

    try {
      const geo = await reverseGeocode(parsed.data.lat, parsed.data.lng)
      const address = composeMarketMapAddress({
        neighborhood: geo.neighborhood,
        city: parsed.data.city,
        state: parsed.data.state,
      })

      const evaluationArea =
        parsed.data.area > 0 ? parsed.data.area : MARKET_MAP_DEFAULT_AREA

      const result = await runPropertyEvaluation({
        ...MARKET_MAP_EVALUATION_DEFAULTS,
        address,
        propertyType: parsed.data.propertyType,
        area: evaluationArea,
        bedrooms: isLandOnlyPropertyType(parsed.data.propertyType)
          ? 0
          : (parsed.data.bedrooms ?? 0),
        listingIntent: parsed.data.listingIntent,
      })

      const pricing = resolveMarketMapPricing(result, {
        requestedArea: parsed.data.area,
        propertyType: parsed.data.propertyType,
      })

      const comparablesCount = result.marketAnalysis.comparables.length

      if (pricing.valuePerSqm <= 0 && comparablesCount === 0) {
        return res.status(404).json({
          message:
            'Não encontramos dados suficientes para esta região. Tente outro ponto ou ajuste os filtros.',
        })
      }

      return res.json({
        valuePerSqm: pricing.valuePerSqm,
        averagePricePerSqm: pricing.averagePricePerSqm,
        priceRange: pricing.priceRange,
        estimatedTotalValue: pricing.estimatedTotalValue,
        showTotalValue: pricing.showTotalValue,
        address,
        neighborhood: geo.neighborhood,
        score: result.score,
        scoreLabel: result.scoreLabel,
        comparablesCount,
        listingIntent: parsed.data.listingIntent,
        lat: parsed.data.lat,
        lng: parsed.data.lng,
      })
    } catch (error) {
      console.error('Erro no mapa de mercado:', error)
      const message =
        error instanceof Error
          ? error.message
          : 'Erro ao consultar preço no mapa.'
      return res.status(500).json({ message })
    }
  }
)

router.post('/publish-lead', requireAuth, async (req: AuthRequest, res) => {
  const parsed = publishLeadSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
    })
  }

  try {
    const result = await publishEvaluationAsLead({
      evaluationId: parsed.data.evaluationId,
      userId: req.user!.id,
      phone: parsed.data.phone,
    })

    let creditsEarned = 0
    let credits: number | undefined

    if (result.created && req.user!.accountType === 'pf') {
      const reward = await grantPfPublishReward(
        req.user!.id,
        parsed.data.evaluationId
      )
      creditsEarned = reward.amount
      credits = reward.credits
    }

    return res.status(result.created ? 201 : 200).json({
      published: true,
      alreadyPublished: !result.created,
      creditsEarned,
      credits,
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Erro ao disponibilizar o imóvel.'
    const status = /não encontrada|apenas para proprietários/i.test(message)
      ? 403
      : 500
    return res.status(status).json({ message })
  }
})

export default router
