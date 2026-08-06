import { isLandOnlyPropertyType } from '../constants/evaluation-defaults.js'
import type { EvaluationAIResponse } from '../types/evaluation.js'

export function resolveMarketMapPricing(
  result: EvaluationAIResponse,
  options: {
    requestedArea: number
    propertyType: string
  }
) {
  const { requestedArea, propertyType } = options
  const userSpecifiedArea = requestedArea > 0
  const isLand = isLandOnlyPropertyType(propertyType)

  const valuePerSqm = result.valuePerSqm
  const averagePricePerSqm =
    result.nbr14653.calculationMemory.homogenizedAveragePriceSqm ??
    result.marketAnalysis.averagePricePerSqm

  const homogenizedUnitPrices = result.nbr14653.homogenizedComparables
    .map((item) => item.homogenizedUnitPriceSqm)
    .filter((price): price is number => price != null && price > 0)

  let priceRange: { min: number; max: number } | null = null

  if (homogenizedUnitPrices.length >= 2) {
    priceRange = {
      min: Math.round(Math.min(...homogenizedUnitPrices)),
      max: Math.round(Math.max(...homogenizedUnitPrices)),
    }
  } else if (result.marketAnalysis.priceRange) {
    priceRange = result.marketAnalysis.priceRange
  } else if (valuePerSqm > 0) {
    priceRange = {
      min: Math.round(valuePerSqm * 0.85),
      max: Math.round(valuePerSqm * 1.15),
    }
  }

  const estimatedTotalValue =
    userSpecifiedArea && valuePerSqm > 0 ? result.estimatedValue : null

  return {
    valuePerSqm,
    averagePricePerSqm:
      averagePricePerSqm != null ? Math.round(averagePricePerSqm) : null,
    priceRange,
    estimatedTotalValue,
    showTotalValue: Boolean(userSpecifiedArea && estimatedTotalValue),
    isLand,
  }
}
