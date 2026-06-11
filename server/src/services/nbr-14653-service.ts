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

const MIN_PLAUSIBLE_UNIT_PRICE_SQM = 1_500
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
  marketAvgPerSqm: number | null
) {
  const price = parsePriceBrl(declaredPrice)
  if (!price) return null

  const priceLooksPerSqm =
    /\/\s*m[²2]|por\s*m[²2]|\/m2/i.test(declaredPrice) ||
    (price >= MIN_PLAUSIBLE_UNIT_PRICE_SQM &&
      price <= 80_000 &&
      (!areaSqm || price < areaSqm * 0.5))

  if (priceLooksPerSqm) {
    return price
  }

  if (!areaSqm || areaSqm <= 0) return null

  const unitFromTotal = price / areaSqm

  if (marketAvgPerSqm && unitFromTotal < marketAvgPerSqm * 0.35) {
    if (price >= marketAvgPerSqm * 0.45 && price <= marketAvgPerSqm * 3) {
      return price
    }
  }

  if (unitFromTotal < MIN_PLAUSIBLE_UNIT_PRICE_SQM && price >= MIN_PLAUSIBLE_UNIT_PRICE_SQM) {
    return price
  }

  return unitFromTotal
}

function resolveComparableUnitPrice(
  item: NbrHomogenizedComparable,
  marketAvgPerSqm: number | null
) {
  if (item.homogenizedUnitPriceSqm != null && item.homogenizedUnitPriceSqm >= MIN_PLAUSIBLE_UNIT_PRICE_SQM) {
    return item.homogenizedUnitPriceSqm
  }

  if (item.unitPriceSqm != null && item.unitPriceSqm >= MIN_PLAUSIBLE_UNIT_PRICE_SQM) {
    const factorProduct = clampFactorProduct(item.factors)
    return item.unitPriceSqm * factorProduct
  }

  const area = item.areaSqm ?? parseAreaSqm(item.area ?? undefined)
  const unitPrice = inferUnitPriceSqm(item.declaredPrice, area, marketAvgPerSqm)
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
  } = input

  const furnitureValue = highEndFurnitureValue ?? 0
  const aiBaseValue = Math.max(0, aiEstimatedValue - furnitureValue)

  let baseValue = calculatedValue
  let valuePerSqm = calculatedValuePerSqm

  const marketFloor =
    marketAvgPerSqm != null ? roundCurrency(marketAvgPerSqm * area * 0.72) : null

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

  if (aiBaseValue > baseValue * 1.35 && aiValuePerSqm >= MIN_PLAUSIBLE_UNIT_PRICE_SQM) {
    baseValue = roundCurrency(baseValue * 0.45 + aiBaseValue * 0.55)
    valuePerSqm = roundCurrency(baseValue / area)
  }

  if (valuePerSqm < MIN_PLAUSIBLE_UNIT_PRICE_SQM && aiValuePerSqm >= MIN_PLAUSIBLE_UNIT_PRICE_SQM) {
    baseValue = roundCurrency(aiValuePerSqm * area)
    valuePerSqm = roundCurrency(aiValuePerSqm)
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
  const comparables = aiNbr?.homogenizedComparables ?? []
  const useMedian = isHighStandardProperty(input)
  const marketAvgPerSqm = aiResult.marketAnalysis.averagePricePerSqm
  const grade = inferSpecificationGrade(
    Math.max(comparables.length, aiResult.marketAnalysis.comparables.length)
  )

  const unitPrices = comparables
    .map((item) => {
      const unitPrice = resolveComparableUnitPrice(item, marketAvgPerSqm)
      if (unitPrice == null || unitPrice < MIN_PLAUSIBLE_UNIT_PRICE_SQM) {
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

  const rawCalculatedValue =
    homogenizedAverage != null
      ? roundCurrency(homogenizedAverage * input.area)
      : aiResult.estimatedValue

  const rawCalculatedValuePerSqm =
    homogenizedAverage != null
      ? roundCurrency(homogenizedAverage)
      : aiResult.valuePerSqm

  const calibrated = calibrateFinalValue({
    calculatedValue: rawCalculatedValue,
    calculatedValuePerSqm: rawCalculatedValuePerSqm,
    aiEstimatedValue: aiResult.estimatedValue,
    aiValuePerSqm: aiResult.valuePerSqm,
    area: input.area,
    askingPrice: input.askingPrice,
    highEndFurnitureValue: input.highEndFurnitureValue,
    marketAvgPerSqm: marketReferencePerSqm,
  })

  const calculatedValue = calibrated.finalValue
  const calculatedValuePerSqm = calibrated.valuePerSqm

  const aggregateLabel = useMedian ? 'mediana' : 'média ponderada'

  const steps = [
    '1. Definição do objetivo: determinação do valor de mercado (NBR 14653-1).',
    `2. Seleção de amostra: ${Math.max(comparables.length, aiResult.marketAnalysis.comparables.length)} elemento(s) comparável(is) de mercado.`,
    useMedian
      ? '3. Tratamento técnico: homogeneização dos comparáveis e agregação por mediana (imóvel de alto padrão — reduz distorção por outliers).'
      : '3. Tratamento técnico: aplicação de fatores de homogeneização aos atributos diferenciais (localização, área, conservação, padrão, idade, layout e mercado).',
    homogenizedAverage != null
      ? `4. Valor unitário homogeneizado (${aggregateLabel}): ${calculatedValuePerSqm.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/m².`
      : '4. Valor unitário estimado com base na amostra e atributos do imóvel avaliando.',
    input.highEndFurnitureValue
      ? `5. Acréscimo de móveis alto padrão: ${input.highEndFurnitureValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`
      : null,
    `6. Valor final do imóvel: ${calculatedValuePerSqm.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/m² × ${input.area} m²${input.highEndFurnitureValue ? ' + móveis' : ''} = ${calculatedValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
  ].filter((step): step is string => step != null)

  const limitations = [
    ...(aiNbr?.limitations ?? []),
    useMedian
      ? 'Imóvel de alto padrão: valor unitário obtido pela mediana dos comparáveis homogeneizados, mais robusta que a média em amostras com dispersão elevada.'
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
