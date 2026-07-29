import { isLandOnlyPropertyType } from '../constants/evaluation-defaults.js'

const MAX_PLAUSIBLE_SQM = 25_000

type MarketAnalysisSlice = {
  averagePricePerSqm: number | null
  priceRange: { min: number; max: number } | null
}

type EvaluationSlice = {
  estimatedValue: number
  valuePerSqm: number
  marketAnalysis: MarketAnalysisSlice
}

export function resolveMarketMapPricing(
  result: EvaluationSlice,
  options: {
    requestedArea: number
    evaluationArea: number
    propertyType: string
  }
) {
  const { requestedArea, evaluationArea, propertyType } = options
  const userSpecifiedArea = requestedArea > 0
  const isLand = isLandOnlyPropertyType(propertyType)
  const marketAvg = result.marketAnalysis.averagePricePerSqm

  let valuePerSqm = marketAvg ?? result.valuePerSqm

  // Quando área não foi informada ou é terreno, prioriza média de comparáveis
  if (marketAvg != null && marketAvg > 0 && (!userSpecifiedArea || isLand)) {
    valuePerSqm = marketAvg
  }

  // Corrige valor que parece total do imóvel exibido como m²
  if (
    marketAvg != null &&
    marketAvg > 0 &&
    (valuePerSqm > MAX_PLAUSIBLE_SQM || valuePerSqm > marketAvg * 8)
  ) {
    valuePerSqm = marketAvg
  }

  const priceRange = normalizePriceRange(
    result.marketAnalysis.priceRange,
    valuePerSqm,
    userSpecifiedArea ? requestedArea : evaluationArea
  )

  const estimatedTotalValue =
    userSpecifiedArea && valuePerSqm > 0
      ? Math.round(valuePerSqm * requestedArea)
      : isLand && !userSpecifiedArea && result.estimatedValue > 0
        ? result.estimatedValue
        : null

  return {
    valuePerSqm: Math.round(valuePerSqm),
    averagePricePerSqm: marketAvg,
    priceRange,
    estimatedTotalValue,
    showTotalValue: Boolean(estimatedTotalValue && (isLand || userSpecifiedArea)),
  }
}

function normalizePriceRange(
  priceRange: { min: number; max: number } | null,
  valuePerSqm: number,
  referenceArea: number
) {
  if (!priceRange) {
    return {
      min: Math.round(valuePerSqm * 0.85),
      max: Math.round(valuePerSqm * 1.15),
    }
  }

  const { min, max } = priceRange
  const looksLikeTotal = min > 20_000 || max > 20_000

  if (looksLikeTotal && referenceArea > 0) {
    return {
      min: Math.round(min / referenceArea),
      max: Math.round(max / referenceArea),
    }
  }

  if (looksLikeTotal && valuePerSqm > 0) {
    return {
      min: Math.round(valuePerSqm * 0.85),
      max: Math.round(valuePerSqm * 1.15),
    }
  }

  return priceRange
}
