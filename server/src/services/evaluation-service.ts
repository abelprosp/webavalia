import type { EvaluationRequest } from '../types/evaluation.js'
import { evaluateWithOpenAI } from './openai-evaluator.js'
import { applyNbr14653ToEvaluation } from './nbr-14653-service.js'
import { searchMarketListings, searchMasterPlan } from './serper.js'

export async function runPropertyEvaluation(input: EvaluationRequest) {
  const [marketResults, masterPlanResults] = await Promise.all([
    searchMarketListings(input),
    searchMasterPlan(input.address),
  ])

  const aiResult = await evaluateWithOpenAI(
    input,
    marketResults,
    masterPlanResults
  )

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
    },
  }
}
