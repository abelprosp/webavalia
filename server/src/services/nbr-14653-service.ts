import {
  getEvaluationArea,
  getMinUnitPriceSqm,
  isLandOnlyPropertyType,
  LAND_PROPERTY_MAX_UNIT_PRICE_SQM,
} from '../constants/evaluation-defaults.js'
import {
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
import {
  canonicalListingUrl,
  filterDuplicateComparables,
} from '../utils/comparable-quality.js'

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
  if (totalWeight <= 0) return median(unitPrices.map((item) => item.value))

  return (
    unitPrices.reduce((sum, item) => sum + item.value * item.weight, 0) /
    totalWeight
  )
}

export function parseMarketNumber(text: string): number | null {
  const match = text.match(/\d[\d.,]*/)
  if (!match) return null
  let value = match[0].replace(/[.,]+$/, '')
  if (value.includes(',')) value = value.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(value)) value = value.replace(/\./g, '')
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function parseAreaSqm(area?: string | null) {
  return area ? parseMarketNumber(area) : null
}

function parsePriceBrl(price: string) {
  const value = parseMarketNumber(price)
  if (!value) return null
  if (/\bmilh(?:ão|ões|ao|oes)\b/i.test(price)) return value * 1_000_000
  if (/\bmil\b/i.test(price)) return value * 1_000
  return value
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
  _marketAvgPerSqm: number | null,
  minUnitPriceSqm: number,
  maxUnitPriceSqm: number
) {
  const price = parsePriceBrl(declaredPrice)
  if (!price) return null

  const priceLooksPerSqm = /\/\s*m[²2]|por\s*m[²2]/i.test(declaredPrice)
  if (priceLooksPerSqm) return price
  if (!areaSqm || areaSqm <= 0) return null
  const unitFromTotal = price / areaSqm

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

export function buildNbr14653Analysis(
  aiResult: EvaluationAIDraftResponse,
  input: EvaluationRequest,
  marketResultsCount: number,
  sourceLinks?: string[]
): Nbr14653Analysis {
  const aiNbr = aiResult.nbr14653
  const isLand = isLandOnlyPropertyType(input.propertyType)
  const rawComparables = aiNbr?.homogenizedComparables ?? []
  const deduplicated = filterDuplicateComparables(rawComparables)
  const neighborhoodFilter = filterComparablesByNeighborhood(
    deduplicated.unique,
    input.address,
    { propertyType: input.propertyType }
  )
  const selectedComparables =
    neighborhoodFilter.filtered.length > 0
      ? neighborhoodFilter.filtered
      : isLand
        ? []
        : deduplicated.unique
  const useMedian = isHighStandardProperty(input) || isLand
  const evaluationArea = getEvaluationArea(input)
  const minUnitPriceSqm = getMinUnitPriceSqm(input.propertyType)
  const maxUnitPriceSqm = isLand ? LAND_PROPERTY_MAX_UNIT_PRICE_SQM : 80_000
  const marketAvgPerSqm = aiResult.marketAnalysis.averagePricePerSqm
  const floorApplicable = [
    'apartamento',
    'cobertura',
    'studio',
    'kitnet',
    'loft',
    'flat',
    'comercial',
    'consultorio',
    'andar-corporativo',
  ].includes(input.propertyType)
  const normalizedComparables = selectedComparables.map((item) => {
    const factors = item.factors.map((factor) => {
      if (
        !/(?:^|[\s_-])(?:floor|andar|andares|elevator|elevador|vertical)(?:$|[\s_-])/i.test(
          `${factor.id} ${factor.label}`
        )
      )
        return factor
      const knownAccess =
        input.elevatorAccess === 'sim' || input.elevatorAccess === 'nao'
      const knownComparableAccess =
        item.elevatorAccess === 'sim' || item.elevatorAccess === 'nao'
      if (
        floorApplicable &&
        input.floor != null &&
        item.floor != null &&
        knownAccess &&
        knownComparableAccess
      )
        return factor
      return {
        ...factor,
        value: 1,
        justification:
          'Ajuste neutro: andar e acesso por elevador precisam estar documentados para ambos os imóveis.',
      }
    })
    const normalized = { ...item, factors }
    return {
      ...normalized,
      homogenizedUnitPriceSqm: resolveComparableUnitPrice(
        normalized,
        marketAvgPerSqm,
        minUnitPriceSqm,
        maxUnitPriceSqm
      ),
    }
  })

  const sourceUrls = new Set(
    (sourceLinks ?? []).map(canonicalListingUrl).filter(Boolean)
  )
  const comparables = normalizedComparables.filter((item) => {
    const numeric = item.homogenizedUnitPriceSqm
    const source = canonicalListingUrl(item.link)
    return (
      numeric != null &&
      Number.isFinite(numeric) &&
      isPlausibleUnitPrice(numeric, minUnitPriceSqm, maxUnitPriceSqm) &&
      (sourceLinks === undefined || (source != null && sourceUrls.has(source)))
    )
  })
  if (sourceLinks !== undefined && comparables.length === 0) {
    throw new Error(
      'Não encontramos comparáveis utilizáveis nas fontes pesquisadas. Revise o endereço e as características do imóvel antes de tentar novamente.'
    )
  }
  const sumWeights = comparables.reduce(
    (sum, item) =>
      sum + (Number.isFinite(item.weight) && item.weight > 0 ? item.weight : 0),
    0
  )
  const aggregateByMedian = useMedian || sumWeights <= 0
  for (const item of comparables) {
    item.weight = aggregateByMedian
      ? 1 / comparables.length
      : Math.max(0, item.weight) / sumWeights
  }

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
      return {
        value: unitPrice,
        weight:
          Number.isFinite(item.weight) && item.weight > 0 ? item.weight : 0,
      }
    })
    .filter((item): item is { value: number; weight: number } => item != null)

  const homogenizedAverage = computeAggregateUnitPrice(
    unitPrices,
    aggregateByMedian,
    marketAvgPerSqm
  )

  const baseUnitPrice = homogenizedAverage ?? aiResult.valuePerSqm
  if (!Number.isFinite(baseUnitPrice) || baseUnitPrice <= 0) {
    throw new Error('Não há dados suficientes para estimar o valor do imóvel.')
  }
  const furnitureValue =
    !isLand && input.amenities?.includes('moveis-alto-padrao')
      ? (input.highEndFurnitureValue ?? 0)
      : 0
  const baseValue = roundCurrency(baseUnitPrice * evaluationArea)
  const calculatedValue = baseValue + furnitureValue
  const calculatedValuePerSqm = roundCurrency(calculatedValue / evaluationArea)

  const aggregateLabel = aggregateByMedian ? 'mediana' : 'média ponderada'

  const matchedSourceCount = comparables.filter((item) =>
    sourceUrls.has(canonicalListingUrl(item.link))
  ).length
  const sampleWarnings = [
    unitPrices.length < 3
      ? 'Menos de três comparáveis utilizáveis: a amostra é insuficiente para uma referência consistente.'
      : null,
    sourceLinks === undefined
      ? 'Os links dos comparáveis não foram cruzados com a pesquisa original.'
      : null,
    deduplicated.duplicatesRemoved > 0
      ? `${deduplicated.duplicatesRemoved} anúncio(s) repetido(s) removido(s) pelo endereço da fonte.`
      : null,
    'Preços de anúncios são ofertas; não comprovam valores de transações concluídas.',
    'Data de publicação e disponibilidade dos anúncios não verificadas.',
    'Correspondência de link confirma presença na pesquisa, não a veracidade dos atributos extraídos.',
  ].filter((warning): warning is string => warning != null)
  const sampleQuality = {
    status:
      unitPrices.length < 3
        ? ('insuficiente' as const)
        : unitPrices.length < 6 || sourceLinks === undefined
          ? ('limitada' as const)
          : ('disponivel' as const),
    receivedCount: rawComparables.length,
    usedCount: unitPrices.length,
    duplicatesRemoved: deduplicated.duplicatesRemoved,
    excludedCount: deduplicated.unique.length - comparables.length,
    matchedSourceCount,
    sourceCheckPerformed: sourceLinks !== undefined,
    observedValueRange:
      unitPrices.length >= 3
        ? {
            min: Math.round(
              Math.min(...unitPrices.map((item) => item.value)) *
                evaluationArea +
                furnitureValue
            ),
            max: Math.round(
              Math.max(...unitPrices.map((item) => item.value)) *
                evaluationArea +
                furnitureValue
            ),
          }
        : null,
    warnings: sampleWarnings,
  }

  const steps = [
    '1. Definição do objetivo: determinação do valor de mercado (NBR 14653-1).',
    `2. Seleção de amostra: ${unitPrices.length} elemento(s) válido(s) comparável(is) de mercado.`,
    useMedian
      ? isLand
        ? '3. Tratamento técnico: homogeneização dos comparáveis de terreno e agregação por mediana (reduz distorção por outliers na amostra).'
        : '3. Tratamento técnico: homogeneização dos comparáveis e agregação por mediana (imóvel de alto padrão — reduz distorção por outliers).'
      : '3. Tratamento técnico: aplicação de fatores de homogeneização aos atributos diferenciais (localização, área, conservação, padrão, idade, layout e mercado).',
    homogenizedAverage != null
      ? `4. Valor unitário homogeneizado (${aggregateLabel}): ${baseUnitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/m².`
      : '4. Valor unitário estimado com base na amostra e atributos do imóvel avaliando.',
    furnitureValue
      ? `5. Acréscimo de móveis alto padrão: ${furnitureValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`
      : null,
    `6. Valor final ${isLand ? 'do terreno' : 'do imóvel'}: ${baseUnitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/m² × ${evaluationArea} m²${furnitureValue ? ' + móveis' : ''} = ${calculatedValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
  ].filter((step): step is string => step != null)

  const limitations = [
    ...(aiNbr?.limitations ?? []),
    ...sampleWarnings,
    'Grau de fundamentação e precisão não aferidos: a quantidade de anúncios não certifica enquadramento na NBR 14653.',
    'Preço pedido usado apenas para comparação comercial, sem impor piso ou teto ao valor estimado.',
    floorApplicable
      ? `Andar: ${input.floor === 0 ? 'térreo' : input.floor == null ? 'não informado' : input.floor + 'º'}; elevador até a unidade: ${input.elevatorAccess ?? 'desconhecido'}. Sem percentual automático por andar; dados ausentes geram fator neutro.`
      : null,
    unitPrices.length === 0
      ? 'Nenhum comparável numérico válido: resultado exploratório baseado na referência retornada pela IA, sem validação amostral.'
      : null,
    'Produto dos fatores limitado entre 0,75 e 1,25 como proteção operacional; esse limite não comprova validade estatística.',

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
    sampleQuality,
    aggregationMethod: aggregateByMedian ? 'mediana' : 'media-ponderada',
    purpose: aiNbr?.purpose ?? NBR_14653_PURPOSE,
    referenceDate: new Date().toISOString().slice(0, 10),
    specificationGrade: null,
    specificationGradeLabel: 'Estimativa automatizada — grau não aferido',
    maxDeviationPercent: null,
    specificationDescription:
      'Precisão depende da qualidade e dispersão dos dados; não há margem de erro garantida.',
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
      steps,
      homogenizedAveragePriceSqm: homogenizedAverage,
      adjustmentsApplied: comparables.flatMap((item) =>
        item.factors.map(
          (factor) =>
            `${item.title}: ${factor.label} × ${factor.value.toFixed(3)} — ${factor.justification}`
        )
      ),
      finalValue: calculatedValue,
      valuePerSqm: calculatedValuePerSqm,
    },
    limitations: [...new Set(limitations)],
    disclaimer: NBR_14653_DISCLAIMER,
  }
}

export function applyNbr14653ToEvaluation(
  aiResult: EvaluationAIDraftResponse,
  input: EvaluationRequest,
  marketResultsCount: number,
  sourceLinks?: string[]
): EvaluationAIResponse {
  const nbr14653 = buildNbr14653Analysis(
    aiResult,
    input,
    marketResultsCount,
    sourceLinks
  )

  const { nbr14653: _draft, ...base } = aiResult

  return {
    ...base,
    estimatedValue: nbr14653.calculationMemory.finalValue,
    valuePerSqm: nbr14653.calculationMemory.valuePerSqm,
    nbr14653,
  }
}
