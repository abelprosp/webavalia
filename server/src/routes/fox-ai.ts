import { Router } from 'express'
import { z } from 'zod'
import { ensureFoxAiTables } from '../db/ensure-fox-ai-tables.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { createUserRateLimiter } from '../middleware/rate-limit.js'
import { isNvidiaConfigured } from '../services/nvidia-nim.js'
import {
  analyzeDashboard,
  chatWithFoxAi,
  chatWithFoxAiStream,
  generateMarketReport,
  getConversation,
  getMarketInsights,
  getProactiveDashboardInsight,
  getSuggestedPrompts,
  listConversations,
  listEvaluationSummaries,
} from '../services/fox-ai-service.js'
import { getPortfolioSnapshot } from '../services/market-analytics-service.js'

const router = Router()

router.use(requireAuth)

async function withFoxAiTables<T>(handler: () => Promise<T>): Promise<T> {
  await ensureFoxAiTables()
  return handler()
}

const foxAiRateLimiter = createUserRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: 'Limite de mensagens FoxAi atingido. Aguarde um minuto.',
})

const reportRateLimiter = createUserRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: 'Limite de relatórios FoxAi atingido. Aguarde alguns minutos.',
})

const dashboardInsightRateLimiter = createUserRateLimiter({
  windowMs: 60 * 1000,
  max: 3,
  message: 'Limite de análises FoxAi atingido. Aguarde um minuto.',
})

const chatSchema = z.object({
  message: z.string().min(1).max(4000),
  conversationId: z.string().uuid().optional(),
  evaluationId: z.string().uuid().optional(),
  dashboardContext: z
    .object({
      credits: z.number().optional(),
      evaluationsTotal: z.number().optional(),
      evaluationsThisMonth: z.number().optional(),
      monthlyCounts: z.record(z.string(), z.number()).optional(),
      leadsTotal: z.number().optional(),
      leadsUnlocked: z.number().optional(),
      currentPage: z.string().optional(),
    })
    .optional(),
})

const dashboardSchema = z.object({
  dashboardContext: chatSchema.shape.dashboardContext,
  force: z.boolean().optional(),
})

router.get('/status', (_req, res) => {
  return res.json({
    available: isNvidiaConfigured(),
    name: 'FoxAi',
    description: 'Especialista em imóveis com IA',
  })
})

router.get('/conversations', async (req: AuthRequest, res) => {
  try {
    const conversations = await withFoxAiTables(() =>
      listConversations(req.user!.id)
    )
    return res.json({ conversations })
  } catch (error) {
    console.error('Erro ao listar conversas FoxAi:', error)
    return res.status(500).json({ message: 'Erro ao carregar conversas.' })
  }
})

router.get('/conversations/:id', async (req: AuthRequest, res) => {
  try {
    const conversation = await withFoxAiTables(() =>
      getConversation(String(req.params.id), req.user!.id)
    )
    if (!conversation) {
      return res.status(404).json({ message: 'Conversa não encontrada.' })
    }
    return res.json({ conversation })
  } catch (error) {
    console.error('Erro ao buscar conversa FoxAi:', error)
    return res.status(500).json({ message: 'Erro ao carregar conversa.' })
  }
})

router.get('/evaluations', async (req: AuthRequest, res) => {
  try {
    const evaluations = await listEvaluationSummaries(req.user!.id)
    return res.json({ evaluations })
  } catch (error) {
    console.error('Erro ao listar avaliações FoxAi:', error)
    return res.status(500).json({ message: 'Erro ao carregar avaliações.' })
  }
})

router.get('/suggested-prompts', async (req: AuthRequest, res) => {
  try {
    const snapshot = await getPortfolioSnapshot(
      req.user!.id,
      req.user!.accountType
    )
    const prompts = getSuggestedPrompts(snapshot, req.user!.accountType)
    return res.json({ prompts })
  } catch (error) {
    console.error('Erro ao gerar prompts FoxAi:', error)
    return res.status(500).json({ message: 'Erro ao carregar sugestões.' })
  }
})

router.post('/chat', foxAiRateLimiter, async (req: AuthRequest, res) => {
  if (!isNvidiaConfigured()) {
    return res.status(503).json({
      message: 'FoxAi indisponível no momento. Tente novamente mais tarde.',
      code: 'FOX_AI_NOT_CONFIGURED',
    })
  }

  const parsed = chatSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Mensagem inválida.' })
  }

  try {
    const result = await withFoxAiTables(() =>
      chatWithFoxAi({
        userId: req.user!.id,
        accountType: req.user!.accountType,
        message: parsed.data.message,
        conversationId: parsed.data.conversationId,
        evaluationId: parsed.data.evaluationId,
        dashboardContext: parsed.data.dashboardContext,
      })
    )
    return res.json(result)
  } catch (error) {
    console.error('Erro no chat FoxAi:', error)
    const message =
      error instanceof Error ? error.message : 'Erro ao processar mensagem.'
    return res.status(500).json({ message })
  }
})

router.post('/chat/stream', foxAiRateLimiter, async (req: AuthRequest, res) => {
  if (!isNvidiaConfigured()) {
    return res.status(503).json({
      message: 'FoxAi indisponível no momento. Tente novamente mais tarde.',
      code: 'FOX_AI_NOT_CONFIGURED',
    })
  }

  const parsed = chatSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Mensagem inválida.' })
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders()
  }

  try {
    await ensureFoxAiTables()
    const stream = chatWithFoxAiStream({
      userId: req.user!.id,
      accountType: req.user!.accountType,
      message: parsed.data.message,
      conversationId: parsed.data.conversationId,
      evaluationId: parsed.data.evaluationId,
      dashboardContext: parsed.data.dashboardContext,
    })

    for await (const event of stream) {
      res.write(`data: ${JSON.stringify(event)}\n\n`)
    }
    res.write('data: [DONE]\n\n')
    res.end()
  } catch (error) {
    console.error('Erro no stream FoxAi:', error)
    const message =
      error instanceof Error ? error.message : 'Erro ao processar mensagem.'
    res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`)
    res.end()
  }
})

router.post(
  '/analyze-dashboard',
  foxAiRateLimiter,
  async (req: AuthRequest, res) => {
    if (!isNvidiaConfigured()) {
      return res.status(503).json({
        message: 'FoxAi indisponível no momento. Tente novamente mais tarde.',
        code: 'FOX_AI_NOT_CONFIGURED',
      })
    }

    const parsed = dashboardSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ message: 'Contexto inválido.' })
    }

    try {
      const result = await analyzeDashboard({
        userId: req.user!.id,
        accountType: req.user!.accountType,
        dashboardContext: parsed.data.dashboardContext,
      })
      return res.json(result)
    } catch (error) {
      console.error('Erro na análise FoxAi:', error)
      const message =
        error instanceof Error ? error.message : 'Erro ao analisar dashboard.'
      return res.status(500).json({ message })
    }
  }
)

router.post(
  '/dashboard-insight',
  dashboardInsightRateLimiter,
  async (req: AuthRequest, res) => {
    if (!isNvidiaConfigured()) {
      return res.status(503).json({
        message: 'FoxAi indisponível no momento. Tente novamente mais tarde.',
        code: 'FOX_AI_NOT_CONFIGURED',
      })
    }

    const parsed = dashboardSchema.safeParse(req.body ?? {})
    const force = parsed.success ? parsed.data.force : false
    const dashboardContext = parsed.success
      ? parsed.data.dashboardContext
      : undefined

    try {
      const result = await withFoxAiTables(() =>
        getProactiveDashboardInsight({
          userId: req.user!.id,
          accountType: req.user!.accountType,
          dashboardContext,
          force,
        })
      )
      return res.json(result)
    } catch (error) {
      console.error('Erro no insight proativo FoxAi:', error)
      const message =
        error instanceof Error ? error.message : 'Erro ao gerar insight.'
      return res.status(500).json({ message })
    }
  }
)

router.get(
  '/dashboard-insight',
  dashboardInsightRateLimiter,
  async (req: AuthRequest, res) => {
    if (!isNvidiaConfigured()) {
      return res.status(503).json({
        message: 'FoxAi indisponível no momento. Tente novamente mais tarde.',
        code: 'FOX_AI_NOT_CONFIGURED',
      })
    }

    const force = req.query.force === 'true'

    try {
      const result = await withFoxAiTables(() =>
        getProactiveDashboardInsight({
          userId: req.user!.id,
          accountType: req.user!.accountType,
          force,
        })
      )
      return res.json(result)
    } catch (error) {
      console.error('Erro no insight proativo FoxAi:', error)
      const message =
        error instanceof Error ? error.message : 'Erro ao gerar insight.'
      return res.status(500).json({ message })
    }
  }
)

router.post(
  '/market-report',
  reportRateLimiter,
  async (req: AuthRequest, res) => {
    if (!isNvidiaConfigured()) {
      return res.status(503).json({
        message: 'FoxAi indisponível no momento. Tente novamente mais tarde.',
        code: 'FOX_AI_NOT_CONFIGURED',
      })
    }

    try {
      const report = await generateMarketReport(
        req.user!.id,
        req.user!.accountType
      )
      return res.json({ report })
    } catch (error) {
      console.error('Erro no relatório FoxAi:', error)
      const message =
        error instanceof Error ? error.message : 'Erro ao gerar relatório.'
      return res.status(500).json({ message })
    }
  }
)

router.get('/market-insights', async (req: AuthRequest, res) => {
  try {
    const snapshot = await getMarketInsights(
      req.user!.id,
      req.user!.accountType
    )
    return res.json(snapshot)
  } catch (error) {
    console.error('Erro nos insights de mercado:', error)
    return res.status(500).json({ message: 'Erro ao carregar insights.' })
  }
})

export default router
