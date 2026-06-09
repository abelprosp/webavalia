import type { EvaluationRequest } from '../types/evaluation.js'
import { evaluateWithOpenAI } from './openai-evaluator.js'
import { applyNbr14653ToEvaluation } from './nbr-14653-service.js'
import {
  searchFloodRisk,
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
    floodResults,
    appreciationResults,
  ] = await Promise.all([
    searchMarketListings(input),
    searchMasterPlan(input.address),
    searchNeighborhoodProfile(input.address),
    searchFloodRisk(input.address),
    searchMarketAppreciation(input),
  ])

  const aiResult = await evaluateWithOpenAI(input, {
    marketResults,
    masterPlanResults,
    neighborhoodResults,
    floodResults,
    appreciationResults,
  })

  const withNbr = applyNbr14653ToEvaluation(
    aiResult,
    input,
    marketResults.length
  )

  return {
    ...withNbr,
    evaluatedAt: new Date().toISOString(),
    photoCount: input.photos?.length ?? 0,
    sources: {
      marketResultsCount: marketResults.length,
      masterPlanResultsCount: masterPlanResults.length,
      neighborhoodResultsCount: neighborhoodResults.length,
      floodResultsCount: floodResults.length,
      appreciationResultsCount: appreciationResults.length,
    },
  }
}
