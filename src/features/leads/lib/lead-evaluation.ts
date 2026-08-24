import {
  estimateMonthlyRent,
  evaluationFormSchema,
  formatCurrency,
  type EvaluationFormValues,
  type EvaluationResult,
  type ListingIntent,
} from '@/features/avaliacao/data/evaluation-engine'
import {
  deserializeEvaluationResult,
  type SerializedEvaluationResult,
} from '@/features/crm/data/schema'

export function getListingIntentFromInput(
  propertyInput: Record<string, unknown> | null | undefined
): ListingIntent {
  return propertyInput?.listingIntent === 'alugar' ? 'alugar' : 'vender'
}

export function parseLeadEvaluation(
  propertyInput: Record<string, unknown> | null,
  evaluationResult: Record<string, unknown> | null
): { property: EvaluationFormValues; result: EvaluationResult } | null {
  if (!propertyInput || !evaluationResult) return null

  const propertyParsed = evaluationFormSchema.safeParse(propertyInput)
  if (!propertyParsed.success) return null

  const evaluatedAt = evaluationResult.evaluatedAt
  if (typeof evaluatedAt !== 'string') return null

  try {
    const result = deserializeEvaluationResult({
      ...(evaluationResult as SerializedEvaluationResult),
      evaluatedAt,
    })
    return { property: propertyParsed.data, result }
  } catch {
    return null
  }
}

export function getLeadDisplayValue(
  propertyInput: Record<string, unknown> | null | undefined,
  evaluationResult: Record<string, unknown> | null | undefined
) {
  const estimatedValue =
    typeof evaluationResult?.estimatedValue === 'number'
      ? evaluationResult.estimatedValue
      : null

  if (estimatedValue == null) {
    return { value: null as number | null, label: 'Valor est.', suffix: '' }
  }

  const listingIntent = getListingIntentFromInput(propertyInput)
  if (listingIntent === 'alugar') {
    const area =
      typeof propertyInput?.area === 'number' ? propertyInput.area : 0
    const standardLevel =
      propertyInput?.standardLevel === 'alto-padrao' ||
      propertyInput?.standardLevel === 'luxo'
        ? propertyInput.standardLevel
        : 'padrao'
    const rental = estimateMonthlyRent(estimatedValue, {
      area,
      standardLevel,
    })
    return {
      value: rental.monthlyRent,
      label: 'Aluguel est.',
      suffix: '/mês',
      formatted: `${formatCurrency(rental.monthlyRent)}/mês`,
    }
  }

  return {
    value: estimatedValue,
    label: 'Valor est.',
    suffix: '',
    formatted: formatCurrency(estimatedValue),
  }
}
