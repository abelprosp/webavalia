import { isLandOnlyPropertyType } from '../constants/evaluation-defaults.js'

const MIN_PLAUSIBLE_SQM = 150
const MAX_PLAUSIBLE_SQM = 15_000

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

function inferUnitPriceSqm(price: string, areaSqm: number | null) {
  const parsed = parsePriceBrl(price)
  if (!parsed) return null

  const looksPerSqm =
    /\/\s*m[²2]|por\s*m[²2]|\/m2/i.test(price) ||
    (parsed >= MIN_PLAUSIBLE_SQM && parsed <= MAX_PLAUSIBLE_SQM && (!areaSqm || parsed < areaSqm * 0.6))

  if (looksPerSqm) return parsed
  if (!areaSqm || areaSqm <= 0) return null

  const unitFromTotal = parsed / areaSqm
  if (unitFromTotal >= MIN_PLAUSIBLE_SQM && unitFromTotal <= MAX_PLAUSIBLE_SQM) {
    return unitFromTotal
  }

  if (parsed >= MIN_PLAUSIBLE_SQM && parsed <= MAX_PLAUSIBLE_SQM) {
    return parsed
  }

  return null
}

function extractComparableUnitPrices(comparables: ComparableListing[]) {
  const prices: number[] = []

  for (const comparable of comparables) {
    const unit = inferUnitPriceSqm(comparable.price, parseAreaSqm(comparable.area))
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

function clampPlausibleSqm(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null
  if (value < MIN_PLAUSIBLE_SQM || value > MAX_PLAUSIBLE_SQM) return null
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
  const unitPrices = extractComparableUnitPrices(result.marketAnalysis.comparables)
  const marketAvg = clampPlausibleSqm(result.marketAnalysis.averagePricePerSqm)
  const nbrPerSqm = clampPlausibleSqm(result.valuePerSqm)

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
