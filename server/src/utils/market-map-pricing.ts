import {
  getMinUnitPriceSqm,
  isLandOnlyPropertyType,
  LAND_PROPERTY_MAX_UNIT_PRICE_SQM,
} from '../constants/evaluation-defaults.js'

const BUILT_MAX_PLAUSIBLE_SQM = 15_000

type ComparableListing = {
  price: string
  area?: string
}

type MarketAnalysisSlice = {
  averagePricePerSqm: number | null
  priceRange: { min: number; max: number } | null
  comparables: ComparableListing[]
}

type EvaluationSlice = {
  estimatedValue: number
  valuePerSqm: number
  marketAnalysis: MarketAnalysisSlice
}

function parseAreaSqm(area?: string | null) {
  if (!area) return null
  const match = area.replace(/\./g, '').match(/(\d+)/)
  return match ? Number(match[1]) : null
}

function parsePriceBrl(price: string) {
  const digits = price.replace(/[^\d]/g, '')
  if (!digits) return null
  const value = Number(digits)
  return Number.isFinite(value) && value > 0 ? value : null
}

function inferUnitPriceSqm(
  price: string,
  areaSqm: number | null,
  minPlausibleSqm: number,
  maxPlausibleSqm: number
) {
  const parsed = parsePriceBrl(price)
  if (!parsed) return null

  const looksPerSqm =
    /\/\s*m[²2]|por\s*m[²2]|\/m2/i.test(price) ||
    (parsed >= minPlausibleSqm &&
      parsed <= maxPlausibleSqm &&
      (!areaSqm || parsed < areaSqm * 0.6))

  if (looksPerSqm) return parsed
  if (!areaSqm || areaSqm <= 0) return null

  const unitFromTotal = parsed / areaSqm
  if (
    unitFromTotal >= minPlausibleSqm &&
    unitFromTotal <= maxPlausibleSqm
  ) {
    return unitFromTotal
  }

  if (parsed >= minPlausibleSqm && parsed <= maxPlausibleSqm) {
    return parsed
  }

  return null
}

function extractComparableUnitPrices(
  comparables: ComparableListing[],
  minPlausibleSqm: number,
  maxPlausibleSqm: number
) {
  const prices: number[] = []

  for (const comparable of comparables) {
    const unit = inferUnitPriceSqm(
      comparable.price,
      parseAreaSqm(comparable.area),
      minPlausibleSqm,
      maxPlausibleSqm
    )
    if (unit != null) prices.push(unit)
  }

  return prices
}

function median(values: number[]) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2
}

function clampPlausibleSqm(
  value: number | null | undefined,
  minPlausibleSqm: number,
  maxPlausibleSqm: number
) {
  if (value == null || !Number.isFinite(value)) return null
  if (value < minPlausibleSqm || value > maxPlausibleSqm) return null
  return value
}

export function resolveMarketMapPricing(
  result: EvaluationSlice,
  options: {
    requestedArea: number
    propertyType: string
  }
) {
  const { requestedArea, propertyType } = options
  const userSpecifiedArea = requestedArea > 0
  const isLand = isLandOnlyPropertyType(propertyType)
  const minPlausibleSqm = getMinUnitPriceSqm(propertyType)
  const maxPlausibleSqm = isLand
    ? LAND_PROPERTY_MAX_UNIT_PRICE_SQM
    : BUILT_MAX_PLAUSIBLE_SQM
  const unitPrices = extractComparableUnitPrices(
    result.marketAnalysis.comparables,
    minPlausibleSqm,
    maxPlausibleSqm
  )
  const marketAvg = clampPlausibleSqm(
    result.marketAnalysis.averagePricePerSqm,
    minPlausibleSqm,
    maxPlausibleSqm
  )
  const nbrPerSqm = clampPlausibleSqm(
    result.valuePerSqm,
    minPlausibleSqm,
    maxPlausibleSqm
  )

  const medianUnit = median(unitPrices)
  let valuePerSqm = medianUnit ?? marketAvg ?? nbrPerSqm ?? 0
  valuePerSqm = Math.round(valuePerSqm)

  let priceRange: { min: number; max: number } | null = null

  if (unitPrices.length >= 2) {
    priceRange = {
      min: Math.round(Math.min(...unitPrices)),
      max: Math.round(Math.max(...unitPrices)),
    }
  } else if (valuePerSqm > 0) {
    priceRange = {
      min: Math.round(valuePerSqm * 0.85),
      max: Math.round(valuePerSqm * 1.15),
    }
  }

  const estimatedTotalValue =
    userSpecifiedArea && valuePerSqm > 0
      ? Math.round(valuePerSqm * requestedArea)
      : null

  return {
    valuePerSqm,
    averagePricePerSqm: marketAvg ?? (medianUnit != null ? Math.round(medianUnit) : null),
    priceRange,
    estimatedTotalValue,
    showTotalValue: Boolean(userSpecifiedArea && estimatedTotalValue),
    isLand,
  }
}
