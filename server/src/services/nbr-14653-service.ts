import {
  getEvaluationArea,
  getMinUnitPriceSqm,
  isLandOnlyPropertyType,
  LAND_PROPERTY_MAX_UNIT_PRICE_SQM,
} from '../constants/evaluation-defaults.js'
import {
  inferSpecificationGrade,
  NBR_14653_DISCLAIMER,
  NBR_14653_PURPOSE,
  NBR_14653_STANDARD,
  NBR_METHODS,
} from '../constants/nbr-14653.js'
import type {
  EvaluationAIDraftResponse,
  EvaluationAIResponse,
  EvaluationRequest,
  Nbr14653Analysis,
  NbrHomogenizedComparable,
} from '../types/evaluation.js'
import {
  buildCrossNeighborhoodLimitation,
  filterComparablesByNeighborhood,
} from '../utils/comparable-location-filter.js'
const FACTOR_PRODUCT_MIN = 0.75
const FACTOR_PRODUCT_MAX = 1.25
const HIGH_STANDARD_LEVELS = new Set(['alto-padrao', 'luxo'])

export function isHighStandardProperty(input: EvaluationRequest) {
  return (
    HIGH_STANDARD_LEVELS.has(input.standardLevel) ||
    HIGH_STANDARD_LEVELS.has(input.finishLevel) ||
    input.condominiumLevel === 'alto-padrao' ||
    input.condominiumLevel === 'clube'
  )
}

function median(values: number[]) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  }
  return sorted[mid]
}

function computeAggregateUnitPrice(
  unitPrices: { value: number; weight: number }[],
  useMedian: boolean,
  fallback: number | null
) {
  if (unitPrices.length === 0) return fallback

  if (useMedian) {
    const med = median(unitPrices.map((item) => item.value))
    return med != null ? med : fallback
  }

  const totalWeight = unitPrices.reduce((sum, item) => sum + item.weight, 0)
  if (totalWeight <= 0) return fallback

  return (
    unitPrices.reduce((sum, item) => sum + item.value * item.weight, 0) /
    totalWeight
  )
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

function roundCurrency(value: number) {
  return Math.round(value)
}

function clampFactorProduct(factors: NbrHomogenizedComparable['factors']) {
  const product = factors.reduce((acc, factor) => acc * factor.value, 1)
  return Math.min(FACTOR_PRODUCT_MAX, Math.max(FACTOR_PRODUCT_MIN, product))
}

function inferUnitPriceSqm(
  declaredPrice: string,
  areaSqm: number | null,
  marketAvgPerSqm: number | null,
  minUnitPriceSqm: number,
  maxUnitPriceSqm: number
) {
  const price = parsePriceBrl(declaredPrice)
  if (!price) return null

  const priceLooksPerSqm =
    /\/\s*m[²2]|por\s*m[²2]|\/m2/i.test(declaredPrice) ||
    (price >= minUnitPriceSqm &&
      price <= maxUnitPriceSqm &&
      (!areaSqm || price < areaSqm * 0.5))

  if (priceLooksPerSqm) {
    return price
  }

  if (!areaSqm || areaSqm <= 0) return null

  const unitFromTotal = price / areaSqm

  if (marketAvgPerSqm && unitFromTotal < marketAvgPerSqm * 0.35) {
    if (
      price >= marketAvgPerSqm * 0.45 &&
      price <= marketAvgPerSqm * 3
    ) {
      return price
    }
  }

  if (unitFromTotal < minUnitPriceSqm && price >= minUnitPriceSqm) {
    return price
  }

  if (unitFromTotal < minUnitPriceSqm || unitFromTotal > maxUnitPriceSqm) {
    return null
  }

  return unitFromTotal
}

function isPlausibleUnitPrice(
  value: number,
  minUnitPriceSqm: number,
  maxUnitPriceSqm: number
) {
  return value >= minUnitPriceSqm && value <= maxUnitPriceSqm
}

function resolveComparableUnitPrice(
  item: NbrHomogenizedComparable,
  marketAvgPerSqm: number | null,
  minUnitPriceSqm: number,
  maxUnitPriceSqm: number
) {
  if (
    item.homogenizedUnitPriceSqm != null &&
    isPlausibleUnitPrice(
      item.homogenizedUnitPriceSqm,
      minUnitPriceSqm,
      maxUnitPriceSqm
    )
  ) {
    return item.homogenizedUnitPriceSqm
  }

  if (
    item.unitPriceSqm != null &&
    isPlausibleUnitPrice(item.unitPriceSqm, minUnitPriceSqm, maxUnitPriceSqm)
  ) {
    const factorProduct = clampFactorProduct(item.factors)
    return item.unitPriceSqm * factorProduct
  }

  const area = item.areaSqm ?? parseAreaSqm(item.area ?? undefined)
  const unitPrice = inferUnitPriceSqm(
    item.declaredPrice,
    area,
    marketAvgPerSqm,
    minUnitPriceSqm,
    maxUnitPriceSqm
  )
  if (unitPrice == null) return null

  const factorProduct = clampFactorProduct(item.factors)
  return unitPrice * factorProduct
}

function calibrateFinalValue(input: {
  calculatedValue: number
  calculatedValuePerSqm: number
  aiEstimatedValue: number
  aiValuePerSqm: number
  area: number
  askingPrice?: number
  highEndFurnitureValue?: number
  marketAvgPerSqm: number | null
  minUnitPriceSqm: number
  isLand: boolean
}) {
  const {
    calculatedValue,
    calculatedValuePerSqm,
    aiEstimatedValue,
    aiValuePerSqm,
    area,
    askingPrice,
    highEndFurnitureValue,
    marketAvgPerSqm,
    minUnitPriceSqm,
    isLand,
  } = input

  const furnitureValue = highEndFurnitureValue ?? 0
  const aiBaseValue = Math.max(0, aiEstimatedValue - furnitureValue)

  let valuePerSqm = calculatedValuePerSqm

  const marketFloor =
    marketAvgPerSqm != null
      ? roundCurrency(marketAvgPerSqm * area * (isLand ? 0.65 : 0.72))
      : null

  let baseValue =
    valuePerSqm > 0
      ? roundCurrency(valuePerSqm * area)
      : calculatedValue

  if (marketFloor != null && baseValue < marketFloor) {
    baseValue = marketFloor
    valuePerSqm = roundCurrency(baseValue / area)
  }

  const askingBase =
    askingPrice && askingPrice > 0
      ? Math.max(0, askingPrice - furnitureValue)
      : null

  if (askingBase && askingBase > 0 && baseValue < askingBase * 0.55) {
    baseValue = roundCurrency(baseValue * 0.35 + askingBase * 0.65 * 0.88)
    valuePerSqm = roundCurrency(baseValue / area)
  }

  if (
    aiBaseValue > baseValue * 1.35 &&
    aiValuePerSqm >= minUnitPriceSqm
  ) {
    valuePerSqm = roundCurrency(
      valuePerSqm * 0.45 + aiValuePerSqm * 0.55
    )
    baseValue = roundCurrency(valuePerSqm * area)
  }

  if (valuePerSqm < minUnitPriceSqm && aiValuePerSqm >= minUnitPriceSqm) {
    valuePerSqm = roundCurrency(aiValuePerSqm)
    baseValue = roundCurrency(valuePerSqm * area)
  }

  const finalValue = baseValue + furnitureValue

  return { finalValue, valuePerSqm }
}

export function buildNbr14653Analysis(
  aiResult: EvaluationAIDraftResponse,
  input: EvaluationRequest,
  marketResultsCount: number
): Nbr14653Analysis {
  const aiNbr = aiResult.nbr14653
  const isLand = isLandOnlyPropertyType(input.propertyType)
  const rawComparables = aiNbr?.homogenizedComparables ?? []
  const neighborhoodFilter = filterComparablesByNeighborhood(
    rawComparables,
    input.address,
    { propertyType: input.propertyType }
  )
  const comparables =
    neighborhoodFilter.filtered.length > 0
      ? neighborhoodFilter.filtered
      : isLand
        ? []
        : rawComparables
  const useMedian = isHighStandardProperty(input) || isLand
  const evaluationArea = getEvaluationArea(input)
  const minUnitPriceSqm = getMinUnitPriceSqm(input.propertyType)
  const maxUnitPriceSqm = isLand ? LAND_PROPERTY_MAX_UNIT_PRICE_SQM : 80_000
  const marketAvgPerSqm = aiResult.marketAnalysis.averagePricePerSqm
  const grade = inferSpecificationGrade(
    Math.max(comparables.length, aiResult.marketAnalysis.comparables.length)
  )

  const unitPrices = comparables
    .map((item) => {
      const unitPrice = resolveComparableUnitPrice(
        item,
        marketAvgPerSqm,
        minUnitPriceSqm,
        maxUnitPriceSqm
      )
      if (
        unitPrice == null ||
        !isPlausibleUnitPrice(unitPrice, minUnitPriceSqm, maxUnitPriceSqm)
      ) {
        return null
      }
      return { value: unitPrice, weight: item.weight }
    })
    .filter((item): item is { value: number; weight: number } => item != null)

  const homogenizedAverage = computeAggregateUnitPrice(
    unitPrices,
    useMedian,
    marketAvgPerSqm
  )

  const marketReferencePerSqm =
    unitPrices.length > 0 && useMedian
      ? median(unitPrices.map((item) => item.value))
      : marketAvgPerSqm

  const rawCalculatedValuePerSqm =
    homogenizedAverage != null
      ? roundCurrency(homogenizedAverage)
      : aiResult.valuePerSqm

  const rawCalculatedValue =
    rawCalculatedValuePerSqm > 0
      ? roundCurrency(rawCalculatedValuePerSqm * evaluationArea)
      : aiResult.estimatedValue

  const calibrated = calibrateFinalValue({
    calculatedValue: rawCalculatedValue,
    calculatedValuePerSqm: rawCalculatedValuePerSqm,
    aiEstimatedValue: aiResult.estimatedValue,
    aiValuePerSqm: aiResult.valuePerSqm,
    area: evaluationArea,
    askingPrice: input.askingPrice,
    highEndFurnitureValue: input.highEndFurnitureValue,
    marketAvgPerSqm: marketReferencePerSqm,
    minUnitPriceSqm,
    isLand,
  })

  const calculatedValue = calibrated.finalValue
  const calculatedValuePerSqm = calibrated.valuePerSqm

  const aggregateLabel = useMedian ? 'mediana' : 'média ponderada'

  const steps = [
    '1. Definição do objetivo: determinação do valor de mercado (NBR 14653-1).',
    `2. Seleção de amostra: ${Math.max(comparables.length, aiResult.marketAnalysis.comparables.length)} elemento(s) comparável(is) de mercado.`,
    useMedian
      ? isLand
        ? '3. Tratamento técnico: homogeneização dos comparáveis de terreno e agregação por mediana (reduz distorção por outliers na amostra).'
        : '3. Tratamento técnico: homogeneização dos comparáveis e agregação por mediana (imóvel de alto padrão — reduz distorção por outliers).'
      : '3. Tratamento técnico: aplicação de fatores de homogeneização aos atributos diferenciais (localização, área, conservação, padrão, idade, layout e mercado).',
    homogenizedAverage != null
      ? `4. Valor unitário homogeneizado (${aggregateLabel}): ${calculatedValuePerSqm.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/m².`
      : '4. Valor unitário estimado com base na amostra e atributos do imóvel avaliando.',
    input.highEndFurnitureValue
      ? `5. Acréscimo de móveis alto padrão: ${input.highEndFurnitureValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`
      : null,
    `6. Valor final ${isLand ? 'do terreno' : 'do imóvel'}: ${calculatedValuePerSqm.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/m² × ${evaluationArea} m²${input.highEndFurnitureValue ? ' + móveis' : ''} = ${calculatedValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
  ].filter((step): step is string => step != null)

  const limitations = [
    ...(aiNbr?.limitations ?? []),
    neighborhoodFilter.rejectedCount > 0
      ? buildCrossNeighborhoodLimitation(
          input.address,
          neighborhoodFilter.usedCrossNeighborhoodFallback
        )
      : null,
    useMedian
      ? isLand
        ? 'Terreno/lote: valor unitário obtido pela mediana dos comparáveis homogeneizados, mais robusta que a média em amostras com dispersão elevada.'
        : 'Imóvel de alto padrão: valor unitário obtido pela mediana dos comparáveis homogeneizados, mais robusta que a média em amostras com dispersão elevada.'
      : null,
    marketResultsCount < 5
      ? 'Amostra de mercado limitada às fontes digitais disponíveis na data da avaliação.'
      : 'Amostra obtida por pesquisa de mercado em fontes digitais — recomenda-se vistoria presencial para laudo formal.',
    'Fatores de homogeneização estimados com base em inferência técnica e não em vistoria in loco.',
  ].filter((item): item is string => item != null)

  return {
    standard: NBR_14653_STANDARD,
    purpose: aiNbr?.purpose ?? NBR_14653_PURPOSE,
    referenceDate: new Date().toISOString().slice(0, 10),
    specificationGrade: grade.grade,
    specificationGradeLabel: grade.label,
    maxDeviationPercent: grade.maxDeviationPercent,
    specificationDescription: grade.description,
    primaryMethod: {
      id: NBR_METHODS.comparativo_direto.id,
      name: NBR_METHODS.comparativo_direto.name,
      justification:
        aiNbr?.primaryMethod?.justification ??
        'Método preferencial da NBR 14653 para imóveis urbanos com dados de mercado disponíveis, conforme item 11.3.1 do Manual de Avaliação de Imóveis.',
    },
    complementaryMethods: aiNbr?.complementaryMethods ?? [],
    homogenizedComparables: comparables,
    calculationMemory: {
      steps: aiNbr?.calculationMemory?.steps?.length
        ? aiNbr.calculationMemory.steps
        : steps,
      homogenizedAveragePriceSqm: homogenizedAverage,
      adjustmentsApplied:
        aiNbr?.calculationMemory?.adjustmentsApplied ??
        comparables.flatMap((item) =>
          item.factors.map(
            (factor) =>
              `${item.title}: ${factor.label} × ${factor.value.toFixed(3)} — ${factor.justification}`
          )
        ),
      finalValue: calculatedValue,
      valuePerSqm: calculatedValuePerSqm,
    },
    limitations: [...new Set(limitations)],
    disclaimer: aiNbr?.disclaimer ?? NBR_14653_DISCLAIMER,
  }
}

export function applyNbr14653ToEvaluation(
  aiResult: EvaluationAIDraftResponse,
  input: EvaluationRequest,
  marketResultsCount: number
): EvaluationAIResponse {
  const nbr14653 = buildNbr14653Analysis(aiResult, input, marketResultsCount)

  const { nbr14653: _draft, ...base } = aiResult

  return {
    ...base,
    estimatedValue: nbr14653.calculationMemory.finalValue,
    valuePerSqm: nbr14653.calculationMemory.valuePerSqm,
    nbr14653,
  }
}
