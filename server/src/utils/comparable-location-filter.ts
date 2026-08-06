import type { EvaluationAIDraftResponse } from '../types/evaluation.js'
import { isLandOnlyPropertyType } from '../constants/evaluation-defaults.js'
import {
  classifyComparableNeighborhood,
  extractCityFromAddress,
  extractNeighborhoodFromAddress,
} from './address-parsing.js'

type TextComparable = {
  title: string
  snippet?: string
  link?: string
}

export type NeighborhoodFilterResult<T> = {
  filtered: T[]
  rejectedCount: number
  usedCrossNeighborhoodFallback: boolean
  propertyNeighborhood: string | null
}

function getComparableText(item: TextComparable) {
  return `${item.title} ${item.snippet ?? ''}`.trim()
}

export function filterComparablesByNeighborhood<T extends TextComparable>(
  items: T[],
  propertyAddress: string,
  options?: {
    strict?: boolean
    propertyType?: string
  }
): NeighborhoodFilterResult<T> {
  const propertyNeighborhood = extractNeighborhoodFromAddress(propertyAddress)
  if (!propertyNeighborhood || items.length === 0) {
    return {
      filtered: items,
      rejectedCount: 0,
      usedCrossNeighborhoodFallback: false,
      propertyNeighborhood,
    }
  }

  const strict =
    options?.strict ??
    (options?.propertyType
      ? isLandOnlyPropertyType(options.propertyType)
      : false)

  const same: T[] = []
  const unknown: T[] = []
  let rejectedCount = 0

  for (const item of items) {
    const match = classifyComparableNeighborhood(
      getComparableText(item),
      propertyAddress
    )

    if (match === 'same') {
      same.push(item)
    } else if (match === 'different') {
      rejectedCount += 1
    } else {
      unknown.push(item)
    }
  }

  if (same.length > 0) {
    return {
      filtered: strict ? same : [...same, ...unknown],
      rejectedCount,
      usedCrossNeighborhoodFallback: false,
      propertyNeighborhood,
    }
  }

  if (strict) {
    return {
      filtered: unknown,
      rejectedCount,
      usedCrossNeighborhoodFallback: unknown.length > 0,
      propertyNeighborhood,
    }
  }

  const withoutDifferent = items.filter(
    (item) =>
      classifyComparableNeighborhood(getComparableText(item), propertyAddress) !==
      'different'
  )

  return {
    filtered: withoutDifferent.length > 0 ? withoutDifferent : items,
    rejectedCount,
    usedCrossNeighborhoodFallback: withoutDifferent.length < items.length,
    propertyNeighborhood,
  }
}

export function buildCrossNeighborhoodLimitation(
  propertyAddress: string,
  usedFallback: boolean
) {
  const neighborhood = extractNeighborhoodFromAddress(propertyAddress)
  const city = extractCityFromAddress(propertyAddress)

  if (!neighborhood) return null

  if (usedFallback) {
    return `Amostra limitada: não foram encontrados comparáveis suficientes no bairro ${neighborhood}${city ? ` (${city})` : ''}; a estimativa pode ter menor precisão.`
  }

  return `Comparáveis restritos ao bairro ${neighborhood}${city ? ` (${city})` : ''} — anúncios de outros bairros foram excluídos por distorcerem o valor de mercado local.`
}

export function sanitizeEvaluationComparables(
  aiResult: EvaluationAIDraftResponse,
  propertyAddress: string,
  propertyType: string
): EvaluationAIDraftResponse {
  const propertyNeighborhood = extractNeighborhoodFromAddress(propertyAddress)
  if (!propertyNeighborhood) return aiResult

  const marketFilter = filterComparablesByNeighborhood(
    aiResult.marketAnalysis.comparables,
    propertyAddress,
    { propertyType }
  )

  const homogenizedFilter = filterComparablesByNeighborhood(
    aiResult.nbr14653.homogenizedComparables,
    propertyAddress,
    { propertyType }
  )

  const usedFallback =
    marketFilter.usedCrossNeighborhoodFallback ||
    homogenizedFilter.usedCrossNeighborhoodFallback

  const limitation = buildCrossNeighborhoodLimitation(propertyAddress, usedFallback)
  const limitations = limitation
    ? [...new Set([limitation, ...aiResult.nbr14653.limitations])]
    : aiResult.nbr14653.limitations

  if (
    marketFilter.rejectedCount === 0 &&
    homogenizedFilter.rejectedCount === 0 &&
    !usedFallback
  ) {
    return aiResult
  }

  const strictLand = isLandOnlyPropertyType(propertyType)
  const homogenizedComparables = homogenizedFilter.filtered
  const marketComparables = marketFilter.filtered

  return {
    ...aiResult,
    marketAnalysis: {
      ...aiResult.marketAnalysis,
      comparables:
        marketComparables.length > 0
          ? marketComparables
          : strictLand
            ? []
            : aiResult.marketAnalysis.comparables,
    },
    nbr14653: {
      ...aiResult.nbr14653,
      homogenizedComparables:
        homogenizedComparables.length > 0
          ? homogenizedComparables
          : strictLand
            ? []
            : aiResult.nbr14653.homogenizedComparables,
      limitations,
    },
  }
}
