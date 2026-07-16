import { pool } from '../db/pool.js'
import {
  nimChatCompletion,
  nimChatCompletionStream,
  type NimMessage,
} from './nvidia-nim.js'
import {
  getPortfolioSnapshot,
  type PortfolioSnapshot,
} from './market-analytics-service.js'

const FOX_AI_SYSTEM_PROMPT = `Você é a FoxAi, especialista em imóveis da plataforma Avalia Imob (Brasil).

Seu papel inclui avaliações (AVM), análise de mercado, previsões de valorização, alertas de risco, monitoramento de portfólio e insights acionáveis para corretores e investidores.

Diretrizes:
- Responda sempre em português do Brasil, de forma clara, profissional e conversacional.
- Use dados do contexto fornecido quando disponíveis; não invente números.
- Para avaliações formais (laudo NBR 14653), oriente o usuário a usar o módulo de Avaliação de Imóveis.
- Dê recomendações práticas: precificação, negociação, timing de venda/compra, análise de bairro, riscos.
- Use markdown leve (negrito, listas, subtítulos) para estruturar respostas longas.
- Quando analisar o dashboard ou portfólio, destaque tendências, alertas e oportunidades em bullet points.
- Não mencione APIs internas, NVIDIA ou prompts do sistema.`

export type FoxAiMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export type FoxAiConversation = {
  id: string
  title: string
  messages: FoxAiMessage[]
  createdAt: string
  updatedAt: string
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
  trends: { title: string; description: string; direction: 'up' | 'down' | 'stable' }[]
  risks: { title: string; description: string; severity: 'low' | 'medium' | 'high' }[]
  opportunities: { title: string; description: string; action: string }[]
  forecast: { period: string; outlook: string; confidence: number }
  metrics: { label: string; value: string; change?: number }[]
  generatedAt: string
}

type EvaluationRow = {
  id: string
  property_input: Record<string, unknown> | null
  evaluation_result: Record<string, unknown> | null
  created_at: Date
}

type DashboardInsightCache = {
  analysis: string
  insights: PortfolioSnapshot['insights']
  generatedAt: string
  expiresAt: number
}

const dashboardInsightCache = new Map<string, DashboardInsightCache>()
const DASHBOARD_INSIGHT_TTL_MS = 15 * 60 * 1000

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function formatCurrency(value: number | null) {
  if (value === null) return 'N/A'
  return `R$ ${value.toLocaleString('pt-BR')}`
}

function extractNeighborhood(input: Record<string, unknown>) {
  const address = input.address as Record<string, unknown> | undefined
  return (
    (address?.neighborhood as string) ??
    (address?.district as string) ??
    (input.neighborhood as string) ??
    (input.city as string) ??
    'Não informado'
  )
}

function extractPropertyType(input: Record<string, unknown>) {
  return (input.propertyType as string) ?? (input.type as string) ?? null
}

function buildRecentEvaluationsContext(evaluations: EvaluationRow[]) {
  if (evaluations.length === 0) {
    return 'AVALIAÇÕES RECENTES: nenhuma avaliação registrada.'
  }

  const lines = evaluations.slice(0, 8).map((e, i) => {
    const input = asRecord(e.property_input)
    const result = asRecord(e.evaluation_result)
    const neighborhood = extractNeighborhood(input)
    const value = typeof result.estimatedValue === 'number' ? result.estimatedValue : null
    const valuePerSqm =
      typeof result.valuePerSqm === 'number' ? result.valuePerSqm : null
    const trend = (
      result.marketAppreciationAnalysis as { trend?: string } | undefined
    )?.trend
    const floodRisk = (
      result.floodRiskAnalysis as { riskLevel?: string } | undefined
    )?.riskLevel
    const propertyType = extractPropertyType(input)
    const date =
      e.created_at instanceof Date
        ? e.created_at.toLocaleDateString('pt-BR')
        : String(e.created_at)

    return `${i + 1}. [ID: ${e.id}] ${neighborhood}${propertyType ? ` (${propertyType})` : ''} — ${formatCurrency(value)}${valuePerSqm ? ` · ${formatCurrency(valuePerSqm)}/m²` : ''}${trend ? ` · tendência: ${trend}` : ''}${floodRisk ? ` · risco hídrico: ${floodRisk}` : ''} — ${date}`
  })

  return `AVALIAÇÕES RECENTES (últimas ${lines.length}):\n${lines.join('\n')}`
}

function buildPortfolioContext(snapshot: PortfolioSnapshot, evaluations: EvaluationRow[]) {
  return `PORTFÓLIO DO USUÁRIO (dados reais):
- Total de avaliações: ${snapshot.totalEvaluations}
- Avaliações este mês: ${snapshot.evaluationsThisMonth}
- Valor médio avaliado: ${formatCurrency(snapshot.averageValue)}
- Valor médio/m²: ${formatCurrency(snapshot.averageValuePerSqm)}
- Tendência de valorização predominante: ${snapshot.appreciationTrend}
- Créditos disponíveis: ${snapshot.credits}
${snapshot.leadsTotal !== null ? `- Leads captados: ${snapshot.leadsTotal}\n- Leads desbloqueados: ${snapshot.leadsUnlocked}` : ''}
- Bairros mais avaliados: ${snapshot.topNeighborhoods.map((n) => `${n.name} (${n.count}x, média ${formatCurrency(n.avgValue)})`).join(', ') || 'nenhum'}
- Distribuição de risco hídrico: ${snapshot.riskDistribution.map((r) => `${r.level}: ${r.count}`).join(', ') || 'sem dados'}
- Volume mensal: ${Object.entries(snapshot.monthlyVolume).filter(([, v]) => v > 0).map(([m, v]) => `${m}: ${v}`).join(', ') || 'sem avaliações este ano'}
- Insights automáticos: ${snapshot.insights.map((i) => `[${i.severity}] ${i.title}: ${i.description}`).join(' | ') || 'nenhum'}

${buildRecentEvaluationsContext(evaluations)}`
}

function buildDashboardContext(
  snapshot: PortfolioSnapshot,
  evaluations: EvaluationRow[],
  dashboard?: DashboardContext
) {
  const parts = [buildPortfolioContext(snapshot, evaluations)]

  if (dashboard) {
    parts.push(`CONTEXTO DO DASHBOARD (tempo real):
- Página atual: ${dashboard.currentPage ?? 'dashboard'}
- Créditos na tela: ${dashboard.credits ?? snapshot.credits}
- Avaliações totais na tela: ${dashboard.evaluationsTotal ?? snapshot.totalEvaluations}
- Avaliações este mês na tela: ${dashboard.evaluationsThisMonth ?? snapshot.evaluationsThisMonth}
${dashboard.leadsTotal !== undefined ? `- Leads na tela: ${dashboard.leadsTotal}` : ''}
${dashboard.leadsUnlocked !== undefined ? `- Leads desbloqueados na tela: ${dashboard.leadsUnlocked}` : ''}`)
  }

  return parts.join('\n\n')
}

async function getRecentEvaluations(userId: string, limit = 20) {
  const result = await pool.query<EvaluationRow>(
    `SELECT id, property_input, evaluation_result, created_at
     FROM property_evaluations
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  )
  return result.rows
}

async function getEvaluationForUser(evaluationId: string, userId: string) {
  const result = await pool.query<EvaluationRow>(
    `SELECT id, property_input, evaluation_result, created_at
     FROM property_evaluations
     WHERE id = $1 AND user_id = $2`,
    [evaluationId, userId]
  )
  return result.rows[0] ?? null
}

function buildEvaluationDetailContext(evaluation: EvaluationRow) {
  const input = asRecord(evaluation.property_input)
  const result = asRecord(evaluation.evaluation_result)
  const neighborhood = extractNeighborhood(input)
  const address = input.address as Record<string, unknown> | undefined
  const fullAddress =
    typeof input.address === 'string'
      ? input.address
      : [
          address?.street,
          address?.number,
          neighborhood,
          address?.city,
          address?.state,
        ]
          .filter(Boolean)
          .join(', ')

  const appreciation = result.marketAppreciationAnalysis as
    | Record<string, unknown>
    | undefined
  const floodRisk = result.floodRiskAnalysis as Record<string, unknown> | undefined

  return `AVALIAÇÃO SELECIONADA (modo análise de imóvel):
- ID: ${evaluation.id}
- Endereço/região: ${fullAddress || neighborhood}
- Tipo: ${extractPropertyType(input) ?? 'não informado'}
- Área: ${typeof input.area === 'number' ? `${input.area} m²` : 'N/A'}
- Quartos: ${input.bedrooms ?? 'N/A'} | Banheiros: ${input.bathrooms ?? 'N/A'} | Vagas: ${input.parkingSpaces ?? 'N/A'}
- Valor estimado (AVM): ${formatCurrency(typeof result.estimatedValue === 'number' ? result.estimatedValue : null)}
- Valor/m²: ${formatCurrency(typeof result.valuePerSqm === 'number' ? result.valuePerSqm : null)}
- Faixa de valor: ${formatCurrency(typeof result.minValue === 'number' ? result.minValue : null)} — ${formatCurrency(typeof result.maxValue === 'number' ? result.maxValue : null)}
- Tendência de mercado: ${(appreciation?.trend as string) ?? 'indeterminado'}${appreciation?.description ? ` — ${appreciation.description}` : ''}
- Risco hídrico: ${(floodRisk?.riskLevel as string) ?? 'indeterminado'}${floodRisk?.description ? ` — ${floodRisk.description}` : ''}
- Confiança da avaliação: ${result.confidence ?? 'N/A'}
- Data da avaliação: ${evaluation.created_at instanceof Date ? evaluation.created_at.toLocaleDateString('pt-BR') : String(evaluation.created_at)}

O usuário está discutindo esta avaliação específica. Use estes dados como base principal da resposta.`
}

async function getConversationMessages(conversationId: string, userId: string) {
  const result = await pool.query<{
    id: string
    role: string
    content: string
    created_at: Date
  }>(
    `SELECT m.id, m.role, m.content, m.created_at
     FROM fox_ai_messages m
     JOIN fox_ai_conversations c ON c.id = m.conversation_id
     WHERE m.conversation_id = $1 AND c.user_id = $2 AND m.role IN ('user', 'assistant')
     ORDER BY m.created_at ASC`,
    [conversationId, userId]
  )

  return result.rows.map((row) => ({
    id: row.id,
    role: row.role as 'user' | 'assistant',
    content: row.content,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  }))
}

export async function listConversations(userId: string) {
  const result = await pool.query<{
    id: string
    title: string
    created_at: Date
    updated_at: Date
  }>(
    `SELECT id, title, created_at, updated_at
     FROM fox_ai_conversations
     WHERE user_id = $1
     ORDER BY updated_at DESC
     LIMIT 30`,
    [userId]
  )

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at),
  }))
}

export async function getConversation(
  conversationId: string,
  userId: string
): Promise<FoxAiConversation | null> {
  const result = await pool.query<{
    id: string
    title: string
    created_at: Date
    updated_at: Date
  }>(
    `SELECT id, title, created_at, updated_at
     FROM fox_ai_conversations
     WHERE id = $1 AND user_id = $2`,
    [conversationId, userId]
  )

  const row = result.rows[0]
  if (!row) return null

  const messages = await getConversationMessages(conversationId, userId)

  return {
    id: row.id,
    title: row.title,
    messages,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at),
  }
}

export async function listEvaluationSummaries(
  userId: string
): Promise<EvaluationSummary[]> {
  const evaluations = await getRecentEvaluations(userId, 15)
  return evaluations.map((e) => {
    const input = asRecord(e.property_input)
    const result = asRecord(e.evaluation_result)
    const neighborhood = extractNeighborhood(input)
    const value =
      typeof result.estimatedValue === 'number' ? result.estimatedValue : null
    const valuePerSqm =
      typeof result.valuePerSqm === 'number' ? result.valuePerSqm : null

    return {
      id: e.id,
      label: `${neighborhood}${value ? ` — ${formatCurrency(value)}` : ''}`,
      neighborhood,
      estimatedValue: value,
      valuePerSqm,
      propertyType: extractPropertyType(input),
      createdAt:
        e.created_at instanceof Date
          ? e.created_at.toISOString()
          : String(e.created_at),
    }
  })
}

export function getSuggestedPrompts(
  snapshot: PortfolioSnapshot,
  accountType: string
): SuggestedPrompt[] {
  const prompts: SuggestedPrompt[] = [
    {
      id: 'portfolio',
      label: 'Analisar meu portfólio',
      message:
        'Analise meu portfólio de avaliações: tendências, pontos fortes e o que devo monitorar.',
      icon: 'portfolio',
    },
    {
      id: 'opportunity',
      label: 'Oportunidades de investimento',
      message:
        'Com base nas minhas avaliações e bairros monitorados, quais oportunidades de investimento você identifica?',
      icon: 'opportunity',
    },
    {
      id: 'pricing',
      label: 'Precificar imóvel',
      message:
        'Como devo precificar um imóvel para venda rápida sem perder valor? Use meus dados de mercado como referência.',
      icon: 'pricing',
    },
    {
      id: 'market',
      label: 'Relatório de mercado',
      message:
        'Gere um panorama do mercado imobiliário com base no meu histórico de avaliações.',
      icon: 'market',
    },
  ]

  if (snapshot.riskDistribution.some((r) => r.level === 'alto' || r.level === 'moderado')) {
    prompts.push({
      id: 'risk',
      label: 'Avaliar riscos',
      message:
        'Analise os riscos hídricos e de mercado dos imóveis que avaliei. O que devo considerar na negociação?',
      icon: 'risk',
    })
  }

  if (accountType === 'pj' && (snapshot.leadsTotal ?? 0) > 0) {
    prompts.push({
      id: 'leads',
      label: 'Converter leads',
      message: `Tenho ${snapshot.leadsTotal} leads captados. Como priorizar e converter com base no meu portfólio?`,
      icon: 'leads',
    })
  }

  if (snapshot.totalEvaluations === 0) {
    return [
      {
        id: 'start',
        label: 'Começar com a FoxAi',
        message:
          'Sou novo na plataforma. Como a FoxAi pode me ajudar com avaliações e análise de mercado?',
        icon: 'portfolio',
      },
      {
        id: 'pricing',
        label: 'Como precificar?',
        message:
          'Quais fatores devo considerar para precificar um imóvel corretamente?',
        icon: 'pricing',
      },
    ]
  }

  return prompts.slice(0, 6)
}

async function createConversation(userId: string, title: string) {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO fox_ai_conversations (user_id, title)
     VALUES ($1, $2)
     RETURNING id`,
    [userId, title]
  )
  return result.rows[0]!.id
}

async function saveMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string
) {
  const result = await pool.query<{ id: string; created_at: Date }>(
    `INSERT INTO fox_ai_messages (conversation_id, role, content)
     VALUES ($1, $2, $3)
     RETURNING id, created_at`,
    [conversationId, role, content]
  )
  const row = result.rows[0]!
  return {
    id: row.id,
    role,
    content,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  }
}

function deriveTitle(message: string) {
  const cleaned = message.trim().replace(/\s+/g, ' ')
  if (cleaned.length <= 48) return cleaned
  return `${cleaned.slice(0, 45)}...`
}

type ChatInput = {
  userId: string
  accountType: string
  message: string
  conversationId?: string
  evaluationId?: string
  dashboardContext?: DashboardContext
}

async function prepareChatContext(input: ChatInput) {
  const [snapshot, evaluations] = await Promise.all([
    getPortfolioSnapshot(input.userId, input.accountType),
    getRecentEvaluations(input.userId),
  ])

  let contextBlock = buildDashboardContext(
    snapshot,
    evaluations,
    input.dashboardContext
  )

  if (input.evaluationId) {
    const evaluation = await getEvaluationForUser(
      input.evaluationId,
      input.userId
    )
    if (!evaluation) {
      throw new Error('Avaliação não encontrada.')
    }
    contextBlock += `\n\n${buildEvaluationDetailContext(evaluation)}`
  }

  let conversationId = input.conversationId
  if (!conversationId) {
    conversationId = await createConversation(
      input.userId,
      deriveTitle(input.message)
    )
  } else {
    const existing = await getConversation(conversationId, input.userId)
    if (!existing) {
      throw new Error('Conversa não encontrada.')
    }
  }

  const history = await getConversationMessages(conversationId, input.userId)
  const userMessage = await saveMessage(conversationId, 'user', input.message)

  const nimMessages: NimMessage[] = [
    {
      role: 'system',
      content: `${FOX_AI_SYSTEM_PROMPT}\n\n---\n${contextBlock}`,
    },
    ...history.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: input.message },
  ]

  return { snapshot, conversationId, userMessage, nimMessages }
}

export async function chatWithFoxAi(input: ChatInput) {
  const { snapshot, conversationId, userMessage, nimMessages } =
    await prepareChatContext(input)

  const assistantContent = await nimChatCompletion({
    messages: nimMessages,
    temperature: 0.5,
    maxTokens: 1500,
  })

  const assistantMessage = await saveMessage(
    conversationId,
    'assistant',
    assistantContent
  )

  await pool.query(
    `UPDATE fox_ai_conversations SET updated_at = NOW() WHERE id = $1`,
    [conversationId]
  )

  return {
    conversationId,
    userMessage,
    assistantMessage,
    portfolio: snapshot,
  }
}

export async function chatWithFoxAiStream(input: ChatInput) {
  const { snapshot, conversationId, userMessage, nimMessages } =
    await prepareChatContext(input)

  let fullContent = ''
  for await (const chunk of nimChatCompletionStream({
    messages: nimMessages,
    temperature: 0.5,
    maxTokens: 1500,
  })) {
    fullContent += chunk
    yield { type: 'chunk' as const, content: chunk }
  }

  const trimmed = fullContent.trim()
  if (!trimmed) {
    throw new Error('A FoxAi não conseguiu gerar uma resposta. Tente novamente.')
  }

  const assistantMessage = await saveMessage(
    conversationId,
    'assistant',
    trimmed
  )

  await pool.query(
    `UPDATE fox_ai_conversations SET updated_at = NOW() WHERE id = $1`,
    [conversationId]
  )

  yield {
    type: 'done' as const,
    conversationId,
    userMessage,
    assistantMessage,
    portfolio: snapshot,
  }
}

export async function analyzeDashboard(input: {
  userId: string
  accountType: string
  dashboardContext?: DashboardContext
}) {
  const snapshot = await getPortfolioSnapshot(input.userId, input.accountType)
  const evaluations = await getRecentEvaluations(input.userId)
  const contextBlock = buildDashboardContext(
    snapshot,
    evaluations,
    input.dashboardContext
  )

  const prompt = `Analise o dashboard do usuário em tempo real. Forneça:
1. **Resumo executivo** (1 frase)
2. **Tendências** (bullet points)
3. **Alertas** (se houver)
4. **Oportunidades** (ações recomendadas)
5. **Previsão** (perspectiva para os próximos 30 dias com base nos dados)

Use markdown leve. Seja direto e acionável.`

  const content = await nimChatCompletion({
    messages: [
      { role: 'system', content: `${FOX_AI_SYSTEM_PROMPT}\n\n---\n${contextBlock}` },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
    maxTokens: 1200,
  })

  return {
    analysis: content,
    insights: snapshot.insights,
    portfolio: snapshot,
    generatedAt: new Date().toISOString(),
  }
}

export async function getProactiveDashboardInsight(input: {
  userId: string
  accountType: string
  dashboardContext?: DashboardContext
  force?: boolean
}) {
  const cacheKey = input.userId
  const cached = dashboardInsightCache.get(cacheKey)
  if (!force && cached && cached.expiresAt > Date.now()) {
    return {
      analysis: cached.analysis,
      insights: cached.insights,
      generatedAt: cached.generatedAt,
      cached: true,
    }
  }

  const result = await analyzeDashboard({
    userId: input.userId,
    accountType: input.accountType,
    dashboardContext: input.dashboardContext,
  })

  dashboardInsightCache.set(cacheKey, {
    analysis: result.analysis,
    insights: result.insights,
    generatedAt: result.generatedAt,
    expiresAt: Date.now() + DASHBOARD_INSIGHT_TTL_MS,
  })

  return { ...result, cached: false }
}

function buildFallbackMarketReport(snapshot: PortfolioSnapshot): MarketReport {
  const trendDirection =
    snapshot.appreciationTrend === 'valorizacao'
      ? 'up'
      : snapshot.appreciationTrend === 'desvalorizacao'
        ? 'down'
        : 'stable'

  return {
    summary: `Portfólio com ${snapshot.totalEvaluations} avaliação(ões), tendência ${snapshot.appreciationTrend}.`,
    trends: [
      {
        title: 'Tendência predominante',
        description: `Baseado nas avaliações, o mercado aponta ${snapshot.appreciationTrend}.`,
        direction: trendDirection,
      },
      ...(snapshot.evaluationsThisMonth > 0
        ? [
            {
              title: 'Atividade recente',
              description: `${snapshot.evaluationsThisMonth} avaliações realizadas este mês.`,
              direction: 'up' as const,
            },
          ]
        : []),
    ],
    risks: snapshot.riskDistribution
      .filter((r) => r.level === 'alto' || r.level === 'moderado')
      .map((r) => ({
        title: `Risco hídrico ${r.level}`,
        description: `${r.count} imóvel(is) com este nível de risco.`,
        severity: r.level === 'alto' ? ('high' as const) : ('medium' as const),
      })),
    opportunities: snapshot.insights
      .filter((i) => i.type === 'opportunity')
      .map((i) => ({
        title: i.title,
        description: i.description,
        action: 'Avaliar com a FoxAi',
      })),
    forecast: {
      period: '30 dias',
      outlook:
        snapshot.appreciationTrend === 'valorizacao'
          ? 'Perspectiva positiva com valorização nos imóveis monitorados.'
          : snapshot.appreciationTrend === 'desvalorizacao'
            ? 'Cautela recomendada — pressão de desvalorização detectada.'
            : 'Mercado estável — monitore comparáveis regularmente.',
      confidence: snapshot.totalEvaluations >= 5 ? 75 : 50,
    },
    metrics: [
      {
        label: 'Valor médio',
        value: formatCurrency(snapshot.averageValue),
      },
      {
        label: 'Valor/m²',
        value: formatCurrency(snapshot.averageValuePerSqm),
      },
      {
        label: 'Avaliações',
        value: String(snapshot.totalEvaluations),
      },
      {
        label: 'Este mês',
        value: String(snapshot.evaluationsThisMonth),
      },
    ],
    generatedAt: new Date().toISOString(),
  }
}

export async function generateMarketReport(
  userId: string,
  accountType: string
): Promise<MarketReport> {
  const snapshot = await getPortfolioSnapshot(userId, accountType)
  const evaluations = await getRecentEvaluations(userId)
  const contextBlock = buildPortfolioContext(snapshot, evaluations)

  const prompt = `Com base nos dados do portfólio, gere um relatório de mercado estruturado em JSON válido (sem markdown, sem texto extra).

Formato exato:
{
  "summary": "resumo executivo em 1-2 frases",
  "trends": [{"title": "...", "description": "...", "direction": "up|down|stable"}],
  "risks": [{"title": "...", "description": "...", "severity": "low|medium|high"}],
  "opportunities": [{"title": "...", "description": "...", "action": "ação recomendada"}],
  "forecast": {"period": "30 dias", "outlook": "...", "confidence": 0-100},
  "metrics": [{"label": "...", "value": "...", "change": número opcional}]
}

Use apenas dados reais do contexto. Mínimo 2 trends, 1 risk, 2 opportunities.`

  try {
    const raw = await nimChatCompletion({
      messages: [
        { role: 'system', content: `${FOX_AI_SYSTEM_PROMPT}\n\n---\n${contextBlock}` },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      maxTokens: 1500,
    })

    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Omit<MarketReport, 'generatedAt'>
      return {
        ...parsed,
        generatedAt: new Date().toISOString(),
      }
    }
  } catch {
    // fallback abaixo
  }

  return buildFallbackMarketReport(snapshot)
}

export async function getMarketInsights(userId: string, accountType: string) {
  return getPortfolioSnapshot(userId, accountType)
}
