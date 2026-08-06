import {
  getMinUnitPriceSqm,
  isLandOnlyPropertyType,
  LAND_PROPERTY_MAX_UNIT_PRICE_SQM,
} from '../constants/evaluation-defaults.js'
import type { EvaluationAIResponse } from '../types/evaluation.js'

const LAND_OUTLIER_LOW_RATIO = 0.55
const LAND_OUTLIER_HIGH_RATIO = 1.85
const DEFAULT_RANGE_SPREAD_LOW = 0.85
const DEFAULT_RANGE_SPREAD_HIGH = 1.15

function collectPlausibleUnitPrices(
  result: EvaluationAIResponse,
  propertyType: string
): number[] {
  const isLand = isLandOnlyPropertyType(propertyType)
  const minUnit = getMinUnitPriceSqm(propertyType)
  const maxUnit = isLand ? LAND_PROPERTY_MAX_UNIT_PRICE_SQM : 80_000

  return result.nbr14653.homogenizedComparables
    .map((item) => item.homogenizedUnitPriceSqm)
    .filter(
      (price): price is number =>
        price != null &&
        price > 0 &&
        price >= minUnit &&
        price <= maxUnit
    )
}

function filterOutlierUnitPrices(
  prices: number[],
  reference: number,
  isLand: boolean
): number[] {
  if (prices.length === 0 || reference <= 0) return prices

  if (isLand) {
    const min = reference * LAND_OUTLIER_LOW_RATIO
    const max = reference * LAND_OUTLIER_HIGH_RATIO
    const filtered = prices.filter((price) => price >= min && price <= max)
    if (filtered.length >= 2) return filtered

    return prices.filter(
      (price) => Math.abs(price - reference) / reference <= 0.25
    )
  }

  if (prices.length >= 4) {
    const sorted = [...prices].sort((a, b) => a - b)
    const q1 = sorted[Math.floor(sorted.length * 0.25)]
    const q3 = sorted[Math.floor(sorted.length * 0.75)]
    const iqr = q3 - q1
    const min = q1 - 1.5 * iqr
    const max = q3 + 1.5 * iqr
    const filtered = prices.filter((price) => price >= min && price <= max)
    if (filtered.length >= 2) return filtered
  }

  return prices
}

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

  const homogenizedAverage =
    result.nbr14653.calculationMemory.homogenizedAveragePriceSqm ??
    result.marketAnalysis.averagePricePerSqm

  const valuePerSqm =
    homogenizedAverage != null && homogenizedAverage > 0
      ? Math.round(homogenizedAverage)
      : Math.round(result.valuePerSqm)

  const rawUnitPrices = collectPlausibleUnitPrices(result, propertyType)
  const filteredUnitPrices = filterOutlierUnitPrices(
    rawUnitPrices,
    valuePerSqm,
    isLand
  )

  let priceRange: { min: number; max: number } | null = null

  if (filteredUnitPrices.length >= 2) {
    priceRange = {
      min: Math.round(Math.min(...filteredUnitPrices)),
      max: Math.round(Math.max(...filteredUnitPrices)),
    }
  } else if (valuePerSqm > 0) {
    priceRange = {
      min: Math.round(valuePerSqm * DEFAULT_RANGE_SPREAD_LOW),
      max: Math.round(valuePerSqm * DEFAULT_RANGE_SPREAD_HIGH),
    }
  } else if (result.marketAnalysis.priceRange) {
    priceRange = result.marketAnalysis.priceRange
  }

  const estimatedTotalValue =
    userSpecifiedArea && valuePerSqm > 0
      ? Math.round(valuePerSqm * requestedArea)
      : null

  return {
    valuePerSqm,
    priceRange,
    estimatedTotalValue,
    showTotalValue: Boolean(userSpecifiedArea && estimatedTotalValue),
    isLand,
  }
}
