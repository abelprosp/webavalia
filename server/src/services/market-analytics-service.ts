import { pool } from '../db/pool.js'

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

type EvaluationRow = {
  property_input: Record<string, unknown> | null
  evaluation_result: Record<string, unknown> | null
  created_at: Date
}

type AppreciationTrend = PortfolioSnapshot['appreciationTrend']

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

async function safeCountQuery(
  query: string,
  params: unknown[] = []
): Promise<number> {
  try {
    const result = await pool.query<{ count: string }>(query, params)
    return Number(result.rows[0]?.count ?? 0)
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String(error.code)
        : ''
    if (code === '42P01') return 0
    throw error
  }
}

function normalizeAppreciationTrend(value: string | undefined): AppreciationTrend {
  if (
    value === 'valorizacao' ||
    value === 'estavel' ||
    value === 'desvalorizacao' ||
    value === 'indeterminado'
  ) {
    return value
  }
  return 'indeterminado'
}

const MONTH_KEYS = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
] as const

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

function extractValue(result: Record<string, unknown>) {
  return typeof result.estimatedValue === 'number' ? result.estimatedValue : null
}

function extractValuePerSqm(result: Record<string, unknown>) {
  return typeof result.valuePerSqm === 'number' ? result.valuePerSqm : null
}

function extractAppreciationTrend(
  result: Record<string, unknown>
): AppreciationTrend | null {
  const analysis = result.marketAppreciationAnalysis as
    | { trend?: string }
    | undefined
  const trend = analysis?.trend
  if (
    trend === 'valorizacao' ||
    trend === 'estavel' ||
    trend === 'desvalorizacao' ||
    trend === 'indeterminado'
  ) {
    return trend
  }
  return null
}

function extractFloodRisk(result: Record<string, unknown>) {
  const analysis = result.floodRiskAnalysis as { riskLevel?: string } | undefined
  return analysis?.riskLevel ?? null
}

function buildInsights(data: {
  evaluations: EvaluationRow[]
  evaluationsThisMonth: number
  previousMonthCount: number
  appreciationCounts: Record<string, number>
  riskCounts: Record<string, number>
  avgValueChange: number | null
  leadsTotal: number | null
  credits: number
}): MarketInsight[] {
  const insights: MarketInsight[] = []

  if (data.evaluations.length === 0) {
    insights.push({
      id: 'no-data',
      type: 'opportunity',
      title: 'Comece seu portfólio analítico',
      description:
        'Realize sua primeira avaliação para a FoxAi gerar insights de mercado, previsões e alertas para o seu portfólio.',
      severity: 'info',
    })
    return insights
  }

  if (data.evaluationsThisMonth > data.previousMonthCount) {
    const diff = data.evaluationsThisMonth - data.previousMonthCount
    insights.push({
      id: 'volume-up',
      type: 'trend',
      title: 'Atividade em alta',
      description: `Você realizou ${data.evaluationsThisMonth} avaliações este mês (+${diff} vs mês anterior).`,
      severity: 'success',
      metric: String(data.evaluationsThisMonth),
      change: diff,
    })
  }

  const valorizacao = data.appreciationCounts.valorizacao ?? 0
  const desvalorizacao = data.appreciationCounts.desvalorizacao ?? 0
  if (valorizacao > desvalorizacao) {
    insights.push({
      id: 'market-up',
      type: 'forecast',
      title: 'Tendência de valorização',
      description: `${valorizacao} dos seus imóveis avaliados apontam valorização de mercado.`,
      severity: 'success',
    })
  } else if (desvalorizacao > valorizacao) {
    insights.push({
      id: 'market-down',
      type: 'risk',
      title: 'Atenção: pressão de desvalorização',
      description: `${desvalorizacao} avaliações indicam desvalorização. Revise precificação e comparáveis.`,
      severity: 'warning',
    })
  }

  const altoRisco = (data.riskCounts.alto ?? 0) + (data.riskCounts.moderado ?? 0)
  if (altoRisco > 0) {
    insights.push({
      id: 'flood-risk',
      type: 'risk',
      title: 'Risco hídrico detectado',
      description: `${altoRisco} imóvel(is) com risco hídrico moderado ou alto. Considere na precificação.`,
      severity: altoRisco >= 2 ? 'critical' : 'warning',
    })
  }

  if (data.avgValueChange !== null && Math.abs(data.avgValueChange) >= 5) {
    insights.push({
      id: 'value-shift',
      type: 'trend',
      title: data.avgValueChange > 0 ? 'Valor médio em alta' : 'Valor médio em queda',
      description: `O valor médio das avaliações recentes ${data.avgValueChange > 0 ? 'subiu' : 'caiu'} ${Math.abs(data.avgValueChange).toFixed(1)}% em relação às anteriores.`,
      severity: data.avgValueChange > 0 ? 'success' : 'warning',
      change: data.avgValueChange,
    })
  }

  if (data.leadsTotal !== null && data.leadsTotal > 0) {
    insights.push({
      id: 'leads-pipeline',
      type: 'opportunity',
      title: 'Pipeline de leads ativo',
      description: `${data.leadsTotal} lead(s) captados. Desbloqueie e converta com apoio da FoxAi.`,
      severity: 'info',
      metric: String(data.leadsTotal),
    })
  }

  if (data.credits <= 2) {
    insights.push({
      id: 'low-credits',
      type: 'alert',
      title: 'Créditos baixos',
      description: `Restam ${data.credits} crédito(s). Recarregue para continuar avaliações e análises.`,
      severity: 'warning',
      metric: String(data.credits),
    })
  }

  return insights.slice(0, 6)
}

export async function getPortfolioSnapshot(
  userId: string,
  accountType: string
): Promise<PortfolioSnapshot> {
  const [userResult, evaluationsResult, monthlyResult] = await Promise.all([
    pool.query<{ credits: number }>(
      'SELECT credits FROM users WHERE id = $1',
      [userId]
    ),
    pool.query<EvaluationRow>(
      `SELECT property_input, evaluation_result, created_at
       FROM property_evaluations
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    ),
    pool.query<{ month: number; count: string }>(
      `SELECT EXTRACT(MONTH FROM created_at)::int AS month, COUNT(*)::text AS count
       FROM property_evaluations
       WHERE user_id = $1 AND created_at >= date_trunc('year', NOW())
       GROUP BY EXTRACT(MONTH FROM created_at)`,
      [userId]
    ),
  ])

  const leadsTotal =
    accountType === 'pj'
      ? await safeCountQuery('SELECT COUNT(*)::text AS count FROM leads')
      : null
  const leadsUnlocked =
    accountType === 'pj'
      ? await safeCountQuery(
          'SELECT COUNT(*)::text AS count FROM lead_unlocks WHERE user_id = $1',
          [userId]
        )
      : null

  const evaluations = evaluationsResult.rows
  const credits = userResult.rows[0]?.credits ?? 0

  const monthlyVolume = Object.fromEntries(
    MONTH_KEYS.map((key) => [key, 0])
  ) as Record<string, number>
  for (const row of monthlyResult.rows) {
    const key = MONTH_KEYS[row.month - 1]
    if (key) monthlyVolume[key] = Number(row.count)
  }

  const currentMonth = new Date().getMonth()
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1
  const evaluationsThisMonth = monthlyVolume[MONTH_KEYS[currentMonth]] ?? 0
  const previousMonthCount = monthlyVolume[MONTH_KEYS[prevMonth]] ?? 0

  const values = evaluations
    .map((e) => extractValue(asRecord(e.evaluation_result)))
    .filter((v): v is number => v !== null)
  const valuesPerSqm = evaluations
    .map((e) => extractValuePerSqm(asRecord(e.evaluation_result)))
    .filter((v): v is number => v !== null)

  const neighborhoodMap = new Map<
    string,
    { count: number; values: number[] }
  >()
  for (const evaluation of evaluations) {
    const input = asRecord(evaluation.property_input)
    const result = asRecord(evaluation.evaluation_result)
    const name = extractNeighborhood(input)
    const value = extractValue(result)
    const entry = neighborhoodMap.get(name) ?? { count: 0, values: [] }
    entry.count += 1
    if (value !== null) entry.values.push(value)
    neighborhoodMap.set(name, entry)
  }

  const topNeighborhoods = [...neighborhoodMap.entries()]
    .map(([name, data]) => ({
      name,
      count: data.count,
      avgValue:
        data.values.length > 0
          ? Math.round(
              data.values.reduce((a, b) => a + b, 0) / data.values.length
            )
          : null,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const appreciationCounts: Record<string, number> = {}
  const riskCounts: Record<string, number> = {}
  for (const evaluation of evaluations) {
    const result = asRecord(evaluation.evaluation_result)
    const trend = extractAppreciationTrend(result)
    if (trend) appreciationCounts[trend] = (appreciationCounts[trend] ?? 0) + 1
    const risk = extractFloodRisk(result)
    if (risk) riskCounts[risk] = (riskCounts[risk] ?? 0) + 1
  }

  const dominantTrend = normalizeAppreciationTrend(
    Object.entries(appreciationCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
  )

  const recentValues = values.slice(0, Math.min(5, values.length))
  const olderValues = values.slice(5, Math.min(10, values.length))
  let avgValueChange: number | null = null
  if (recentValues.length > 0 && olderValues.length > 0) {
    const recentAvg =
      recentValues.reduce((a, b) => a + b, 0) / recentValues.length
    const olderAvg =
      olderValues.reduce((a, b) => a + b, 0) / olderValues.length
    if (olderAvg > 0) {
      avgValueChange = ((recentAvg - olderAvg) / olderAvg) * 100
    }
  }

  const insights = buildInsights({
    evaluations,
    evaluationsThisMonth,
    previousMonthCount,
    appreciationCounts,
    riskCounts,
    avgValueChange,
    leadsTotal,
    credits,
  })

  return {
    totalEvaluations: evaluations.length,
    evaluationsThisMonth,
    averageValue:
      values.length > 0
        ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
        : null,
    averageValuePerSqm:
      valuesPerSqm.length > 0
        ? Math.round(
            valuesPerSqm.reduce((a, b) => a + b, 0) / valuesPerSqm.length
          )
        : null,
    topNeighborhoods,
    appreciationTrend: dominantTrend,
    riskDistribution: Object.entries(riskCounts).map(([level, count]) => ({
      level,
      count,
    })),
    monthlyVolume,
    leadsTotal,
    leadsUnlocked,
    credits,
    insights,
  }
}
