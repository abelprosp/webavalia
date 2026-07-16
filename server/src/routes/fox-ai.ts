import { Router } from 'express'
import { z } from 'zod'
import { ensureFoxAiTables } from '../db/ensure-fox-ai-tables.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { createUserRateLimiter } from '../middleware/rate-limit.js'
import { isNvidiaConfigured } from '../services/nvidia-nim.js'
import {
  analyzeDashboard,
  chatWithFoxAi,
  getConversation,
  getMarketInsights,
  listConversations,
} from '../services/fox-ai-service.js'

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

const chatSchema = z.object({
  message: z.string().min(1).max(4000),
  conversationId: z.string().uuid().optional(),
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
})

router.get('/status', (_req, res) => {
  return res.json({
    available: isNvidiaConfigured(),
    model: isNvidiaConfigured() ? process.env.NVIDIA_MODEL ?? 'meta/llama-3.3-70b-instruct' : null,
    name: 'FoxAi',
    description: 'Especialista em imóveis com IA NVIDIA NIM',
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

router.get(
  '/conversations/:id',
  async (req: AuthRequest, res) => {
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
  }
)

router.post('/chat', foxAiRateLimiter, async (req: AuthRequest, res) => {
  if (!isNvidiaConfigured()) {
    return res.status(503).json({
      message:
        'FoxAi indisponível. Configure NVIDIA_API_KEY (gratuita em build.nvidia.com).',
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

router.post(
  '/analyze-dashboard',
  foxAiRateLimiter,
  async (req: AuthRequest, res) => {
    if (!isNvidiaConfigured()) {
      return res.status(503).json({
        message:
          'FoxAi indisponível. Configure NVIDIA_API_KEY (gratuita em build.nvidia.com).',
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
