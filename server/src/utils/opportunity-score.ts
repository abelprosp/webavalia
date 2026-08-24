/**
 * Scores do radar (0–100) usados no opportunityScore ao publicar lead.
 * Derivados dos criteriaScores (1–5) e da análise de valorização.
 */

type Criterion = { id: string; score: number }

function criterionTo100(criteria: Criterion[] | undefined, id: string, fallback = 70) {
  const found = criteria?.find((c) => c.id === id)
  if (!found || typeof found.score !== 'number') return fallback
  // criteriaScores são 1–5 → escala 0–100
  return Math.round(Math.min(5, Math.max(1, found.score)) * 20)
}

function appreciationTo100(
  appreciation:
    | {
        annualGrowthEstimatePercent?: number | null
        trend?: string
      }
    | null
    | undefined
) {
  if (!appreciation) return 70
  const growth = appreciation.annualGrowthEstimatePercent
  if (typeof growth === 'number' && Number.isFinite(growth)) {
    // 0% → 50, 5% → 75, 10%+ → ~100
    return Math.min(100, Math.max(0, Math.round(50 + growth * 5)))
  }
  switch (appreciation.trend) {
    case 'valorizacao':
      return 80
    case 'estavel':
      return 65
    case 'desvalorizacao':
      return 40
    default:
      return 70
  }
}

export type RadarScores = {
  finishScore: number
  conservationScore: number
  locationScore: number
  constructionScore: number
  appreciationScore: number
  confidence: number
  opportunityScore: number
}

/**
 * Calcula scores do radar e opportunityScore (média ponderada real, não cosmético).
 */
export function computeRadarScoresFromEvaluation(result: {
  score?: number
  criteriaScores?: Criterion[]
  marketAppreciationAnalysis?: {
    annualGrowthEstimatePercent?: number | null
    trend?: string
  } | null
  finishScore?: number
  conservationScore?: number
  locationScore?: number
  constructionScore?: number
  appreciationScore?: number
}): RadarScores {
  const confidence = Math.min(
    100,
    Math.max(0, Math.round(Number(result.score ?? 70)))
  )

  const finishScore =
    typeof result.finishScore === 'number'
      ? result.finishScore
      : criterionTo100(result.criteriaScores, 'layout', 70)
  const conservationScore =
    typeof result.conservationScore === 'number'
      ? result.conservationScore
      : criterionTo100(result.criteriaScores, 'condition', 70)
  const locationScore =
    typeof result.locationScore === 'number'
      ? result.locationScore
      : criterionTo100(result.criteriaScores, 'location', 70)
  // construção ≈ infraestrutura + padrão implícito no score de layout/infra
  const constructionScore =
    typeof result.constructionScore === 'number'
      ? result.constructionScore
      : Math.round(
          (criterionTo100(result.criteriaScores, 'infrastructure', 70) +
            criterionTo100(result.criteriaScores, 'layout', 70)) /
            2
        )
  const appreciationScore =
    typeof result.appreciationScore === 'number'
      ? result.appreciationScore
      : appreciationTo100(result.marketAppreciationAnalysis)

  const parts = [
    confidence,
    finishScore,
    conservationScore,
    locationScore,
    constructionScore,
    appreciationScore,
  ]
  const opportunityScore = Math.min(
    100,
    Math.max(0, Math.round(parts.reduce((a, b) => a + b, 0) / parts.length))
  )

  return {
    finishScore,
    conservationScore,
    locationScore,
    constructionScore,
    appreciationScore,
    confidence,
    opportunityScore,
  }
}

/** Enriquece o resultado da avaliação com scores numéricos do radar. */
export function enrichEvaluationWithRadarScores<T extends Record<string, unknown>>(
  result: T
): T & RadarScores {
  const scores = computeRadarScoresFromEvaluation(
    result as Parameters<typeof computeRadarScoresFromEvaluation>[0]
  )
  return { ...result, ...scores }
}
