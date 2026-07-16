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
  appreciationTrend: 'valorizacao' | 'estavel' | 'desvalorizacao' | 'indeterminado'
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
  model: string | null
  name: string
  description: string
}

export async function getFoxAiStatus() {
  const { data } = await api.get<FoxAiStatus>('/fox-ai/status')
  return data
}

export async function getMarketInsights() {
  const { data } = await api.get<PortfolioSnapshot>('/fox-ai/market-insights')
  return data
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

export async function sendFoxAiMessage(input: {
  message: string
  conversationId?: string
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

export async function listFoxAiConversations() {
  const { data } = await api.get<{
    conversations: {
      id: string
      title: string
      createdAt: string
      updatedAt: string
    }[]
  }>('/fox-ai/conversations')
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
