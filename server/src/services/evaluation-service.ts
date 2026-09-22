import { getEvaluationArea } from '../constants/evaluation-defaults.js'
import type { EvaluationRequest } from '../types/evaluation.js'
import { sanitizeEvaluationComparables } from '../utils/comparable-location-filter.js'
import { enrichEvaluationWithRadarScores } from '../utils/opportunity-score.js'
import { computeSaleScenarios } from '../utils/sale-scenarios.js'
import { applyNbr14653ToEvaluation } from './nbr-14653-service.js'
import { evaluateWithOpenAI } from './openai-evaluator.js'
import {
  SerperCreditsError,
  searchMarketAppreciation,
  searchMarketListings,
  searchMasterPlan,
  searchNeighborhoodProfile,
  type SerperResult,
} from './serper.js'

function isSerperCreditsFailure(error: unknown) {
  if (error instanceof SerperCreditsError) return true
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  return (
    msg.includes('not enough credits') ||
    msg.includes('insufficient credits') ||
    msg.includes('out of credits') ||
    msg.includes('serper credits')
  )
}

async function safeSerperSearch<T extends SerperResult[]>(
  label: string,
  run: () => Promise<T>
): Promise<{ results: T; creditsExhausted: boolean }> {
  try {
    return { results: await run(), creditsExhausted: false }
  } catch (error) {
    if (isSerperCreditsFailure(error)) {
      console.error(
        `[serper] ${label}: créditos esgotados — seguindo sem esta fonte.`,
        error instanceof Error ? error.message : error
      )
      return { results: [] as unknown as T, creditsExhausted: true }
    }
    throw error
  }
}

export async function runPropertyEvaluation(input: EvaluationRequest) {
  const [market, masterPlan, neighborhood, appreciation] = await Promise.all([
    safeSerperSearch('market', () => searchMarketListings(input)),
    safeSerperSearch('masterPlan', () => searchMasterPlan(input.address)),
    safeSerperSearch('neighborhood', () =>
      searchNeighborhoodProfile(input.address)
    ),
    safeSerperSearch('appreciation', () => searchMarketAppreciation(input)),
  ])

  const marketResults = market.results
  const masterPlanResults = masterPlan.results
  const neighborhoodResults = neighborhood.results
  const appreciationResults = appreciation.results
  const serperCreditsExhausted =
    market.creditsExhausted ||
    masterPlan.creditsExhausted ||
    neighborhood.creditsExhausted ||
    appreciation.creditsExhausted

  if (serperCreditsExhausted) {
    console.warn(
      '[serper] Avaliação em modo degradado (sem pesquisa Serper). Atualize SERPER_API_KEY no Railway.'
    )
  }

  const aiResult = await evaluateWithOpenAI(input, {
    marketResults,
    masterPlanResults,
    neighborhoodResults,
    appreciationResults,
  })

  const sanitizedAiResult = sanitizeEvaluationComparables(
    aiResult,
    input.address,
    input.propertyType
  )

  const withNbr = applyNbr14653ToEvaluation(
    sanitizedAiResult,
    input,
    marketResults.length,
    marketResults.map((result) => result.link)
  )

  const listingIntent = input.listingIntent ?? 'vender'
  const evaluationArea = getEvaluationArea(input)

  return enrichEvaluationWithRadarScores({
    ...withNbr,
    saleScenarios:
      listingIntent === 'vender'
        ? computeSaleScenarios(withNbr.estimatedValue, evaluationArea)
        : undefined,
    evaluatedAt: new Date().toISOString(),
    photoCount: input.photos?.length ?? 0,
    sources: {
      marketResultsCount: marketResults.length,
      masterPlanResultsCount: masterPlanResults.length,
      neighborhoodResultsCount: neighborhoodResults.length,
      appreciationResultsCount: appreciationResults.length,
      serperCreditsExhausted: serperCreditsExhausted || undefined,
    },
  })
}
