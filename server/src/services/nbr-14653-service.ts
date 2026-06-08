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
} from '../types/evaluation.js'

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

export function buildNbr14653Analysis(
  aiResult: EvaluationAIDraftResponse,
  input: EvaluationRequest,
  marketResultsCount: number
): Nbr14653Analysis {
  const aiNbr = aiResult.nbr14653
  const comparables = aiNbr?.homogenizedComparables ?? []
  const grade = inferSpecificationGrade(
    Math.max(comparables.length, aiResult.marketAnalysis.comparables.length)
  )

  const weightedValues = comparables
    .map((item) => {
      if (item.homogenizedUnitPriceSqm != null) {
        return { value: item.homogenizedUnitPriceSqm, weight: item.weight }
      }

      const price = parsePriceBrl(item.declaredPrice)
      const area = item.areaSqm ?? parseAreaSqm(item.area ?? undefined)
      if (!price || !area) return null

      const factorProduct = item.factors.reduce((acc, factor) => acc * factor.value, 1)
      const unitPrice = (price / area) * factorProduct
      return { value: unitPrice, weight: item.weight }
    })
    .filter((item): item is { value: number; weight: number } => item != null)

  const totalWeight = weightedValues.reduce((sum, item) => sum + item.weight, 0)
  const homogenizedAverage =
    totalWeight > 0
      ? weightedValues.reduce((sum, item) => sum + item.value * item.weight, 0) /
        totalWeight
      : aiResult.marketAnalysis.averagePricePerSqm

  const calculatedValue =
    homogenizedAverage != null
      ? roundCurrency(homogenizedAverage * input.area)
      : aiResult.estimatedValue

  const calculatedValuePerSqm =
    homogenizedAverage != null
      ? roundCurrency(homogenizedAverage)
      : aiResult.valuePerSqm

  const steps = [
    '1. Definição do objetivo: determinação do valor de mercado (NBR 14653-1).',
    `2. Seleção de amostra: ${Math.max(comparables.length, aiResult.marketAnalysis.comparables.length)} elemento(s) comparável(is) de mercado.`,
    '3. Tratamento técnico: aplicação de fatores de homogeneização aos atributos diferenciais (localização, área, conservação, padrão, idade, layout e mercado).',
    homogenizedAverage != null
      ? `4. Valor unitário homogeneizado médio: ${calculatedValuePerSqm.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/m².`
      : '4. Valor unitário estimado com base na amostra e atributos do imóvel avaliando.',
    `5. Valor final do imóvel: ${calculatedValuePerSqm.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/m² × ${input.area} m² = ${calculatedValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
  ]

  const limitations = [
    ...(aiNbr?.limitations ?? []),
    marketResultsCount < 5
      ? 'Amostra de mercado limitada às fontes digitais disponíveis na data da avaliação.'
      : 'Amostra obtida por pesquisa de mercado em fontes digitais — recomenda-se vistoria presencial para laudo formal.',
    'Fatores de homogeneização estimados com base em inferência técnica e não em vistoria in loco.',
  ]

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
