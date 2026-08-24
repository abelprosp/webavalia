import type { EvaluationRequest } from '../types/evaluation.js'
import { getEvaluationArea } from '../constants/evaluation-defaults.js'
import { computeSaleScenarios } from '../utils/sale-scenarios.js'
import { sanitizeEvaluationComparables } from '../utils/comparable-location-filter.js'
import { enrichEvaluationWithRadarScores } from '../utils/opportunity-score.js'
import { evaluateWithOpenAI } from './openai-evaluator.js'
import { applyNbr14653ToEvaluation } from './nbr-14653-service.js'
import {
  searchMarketAppreciation,
  searchMarketListings,
  searchMasterPlan,
  searchNeighborhoodProfile,
} from './serper.js'

export async function runPropertyEvaluation(input: EvaluationRequest) {
  const [
    marketResults,
    masterPlanResults,
    neighborhoodResults,
    appreciationResults,
  ] = await Promise.all([
    searchMarketListings(input),
    searchMasterPlan(input.address),
    searchNeighborhoodProfile(input.address),
    searchMarketAppreciation(input),
  ])

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
    marketResults.length
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
    },
  })
}
