import { api } from './api'

export type FoxAiMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export type MarketInsight = {
  id: string
  type: 'trend' | 'alert' | 'opportunity' | 'risk' | 'forecast'
  title: string
  description: string
  severity: 'info' | 'warning' | 'success' | 'critical'
  metric?: string
  change?: number
}

export type PortfolioSnapshot = {
  totalEvaluations: number
  evaluationsThisMonth: number
  averageValue: number | null
  averageValuePerSqm: number | null
  topNeighborhoods: { name: string; count: number; avgValue: number | null }[]
  appreciationTrend:
    | 'valorizacao'
    | 'estavel'
    | 'desvalorizacao'
    | 'indeterminado'
  riskDistribution: { level: string; count: number }[]
  monthlyVolume: Record<string, number>
  leadsTotal: number | null
  leadsUnlocked: number | null
  credits: number
  insights: MarketInsight[]
}

export type DashboardContext = {
  credits?: number
  evaluationsTotal?: number
  evaluationsThisMonth?: number
  monthlyCounts?: Record<string, number>
  leadsTotal?: number
  leadsUnlocked?: number
  currentPage?: string
}

export type FoxAiStatus = {
  available: boolean
  name: string
  description: string
}

export type SuggestedPrompt = {
  id: string
  label: string
  message: string
  icon: 'portfolio' | 'opportunity' | 'pricing' | 'market' | 'risk' | 'leads'
}

export type EvaluationSummary = {
  id: string
  label: string
  neighborhood: string
  estimatedValue: number | null
  valuePerSqm: number | null
  propertyType: string | null
  createdAt: string
}

export type MarketReport = {
  summary: string
  trends: {
    title: string
    description: string
    direction: 'up' | 'down' | 'stable'
  }[]
  risks: {
    title: string
    description: string
    severity: 'low' | 'medium' | 'high'
  }[]
  opportunities: { title: string; description: string; action: string }[]
  forecast: { period: string; outlook: string; confidence: number }
  metrics: { label: string; value: string; change?: number }[]
  generatedAt: string
}

export type FoxAiConversationSummary = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

const API_BASE = import.meta.env.VITE_API_URL ?? '/api'

export async function getFoxAiStatus() {
  const { data } = await api.get<FoxAiStatus>('/fox-ai/status')
  return data
}

export async function getMarketInsights() {
  const { data } = await api.get<PortfolioSnapshot>('/fox-ai/market-insights')
  return data
}

export async function getSuggestedPrompts() {
  const { data } = await api.get<{ prompts: SuggestedPrompt[] }>(
    '/fox-ai/suggested-prompts'
  )
  return data.prompts
}

export async function listFoxAiEvaluations() {
  const { data } = await api.get<{ evaluations: EvaluationSummary[] }>(
    '/fox-ai/evaluations'
  )
  return data.evaluations
}

export async function analyzeDashboard(context?: DashboardContext) {
  const { data } = await api.post<{
    analysis: string
    insights: MarketInsight[]
    portfolio: PortfolioSnapshot
    generatedAt: string
  }>('/fox-ai/analyze-dashboard', { dashboardContext: context })
  return data
}

export async function getDashboardInsight(
  force = false,
  context?: DashboardContext
) {
  const { data } = await api.post<{
    analysis: string
    insights: MarketInsight[]
    portfolio?: PortfolioSnapshot
    generatedAt: string
    cached: boolean
  }>('/fox-ai/dashboard-insight', {
    force,
    dashboardContext: context,
  })
  return data
}

export async function generateMarketReport() {
  const { data } = await api.post<{ report: MarketReport }>(
    '/fox-ai/market-report'
  )
  return data.report
}

export async function sendFoxAiMessage(input: {
  message: string
  conversationId?: string
  evaluationId?: string
  dashboardContext?: DashboardContext
}) {
  const { data } = await api.post<{
    conversationId: string
    userMessage: FoxAiMessage
    assistantMessage: FoxAiMessage
    portfolio: PortfolioSnapshot
  }>('/fox-ai/chat', input)
  return data
}

export type StreamFoxAiCallbacks = {
  onChunk: (content: string) => void
  onDone: (result: {
    conversationId: string
    userMessage: FoxAiMessage
    assistantMessage: FoxAiMessage
    portfolio: PortfolioSnapshot
  }) => void
  onError: (message: string) => void
}

export async function streamFoxAiMessage(
  input: {
    message: string
    conversationId?: string
    evaluationId?: string
    dashboardContext?: DashboardContext
  },
  callbacks: StreamFoxAiCallbacks,
  signal?: AbortSignal
) {
  const response = await fetch(`${API_BASE}/fox-ai/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
    signal,
  })

  if (!response.ok) {
    let message = 'Não foi possível enviar a mensagem.'
    try {
      const body = (await response.json()) as { message?: string }
      if (body.message) message = body.message
    } catch {
      if (response.status === 503) {
        message = 'FoxAi indisponível no momento. Tente novamente mais tarde.'
      }
    }
    callbacks.onError(message)
    return
  }

  const reader = response.body?.getReader()
  if (!reader) {
    callbacks.onError('Streaming indisponível.')
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data: ')) continue
      const payload = trimmed.slice(6)
      if (payload === '[DONE]') return

      try {
        const event = JSON.parse(payload) as
          | { type: 'chunk'; content: string }
          | {
              type: 'done'
              conversationId: string
              userMessage: FoxAiMessage
              assistantMessage: FoxAiMessage
              portfolio: PortfolioSnapshot
            }
          | { type: 'error'; message: string }

        if (event.type === 'chunk') {
          callbacks.onChunk(event.content)
        } else if (event.type === 'done') {
          callbacks.onDone({
            conversationId: event.conversationId,
            userMessage: event.userMessage,
            assistantMessage: event.assistantMessage,
            portfolio: event.portfolio,
          })
        } else if (event.type === 'error') {
          callbacks.onError(event.message)
        }
      } catch {
        // ignora eventos malformados
      }
    }
  }
}

export async function listFoxAiConversations() {
  const { data } = await api.get<{ conversations: FoxAiConversationSummary[] }>(
    '/fox-ai/conversations'
  )
  return data.conversations
}

export async function getFoxAiConversation(id: string) {
  const { data } = await api.get<{
    conversation: {
      id: string
      title: string
      messages: FoxAiMessage[]
      createdAt: string
      updatedAt: string
    }
  }>(`/fox-ai/conversations/${id}`)
  return data.conversation
}
