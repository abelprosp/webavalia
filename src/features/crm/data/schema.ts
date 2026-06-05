import type {
  EvaluationFormValues,
  EvaluationResult,
} from '@/features/avaliacao/data/evaluation-engine'

export const crmStatuses = [
  { value: 'novo', label: 'Novo' },
  { value: 'em_negociacao', label: 'Em negociação' },
  { value: 'proposta', label: 'Proposta enviada' },
  { value: 'fechado', label: 'Fechado' },
  { value: 'arquivado', label: 'Arquivado' },
] as const

export type CrmEvaluationStatus = (typeof crmStatuses)[number]['value']

export type SerializedEvaluationResult = Omit<EvaluationResult, 'evaluatedAt'> & {
  evaluatedAt: string
}

export type CrmEvaluation = {
  id: string
  clientName?: string
  notes?: string
  status: CrmEvaluationStatus
  property: EvaluationFormValues
  result: SerializedEvaluationResult
  savedAt: string
}

export function serializeEvaluationResult(
  result: EvaluationResult
): SerializedEvaluationResult {
  return {
    ...result,
    evaluatedAt: result.evaluatedAt.toISOString(),
  }
}

export function deserializeEvaluationResult(
  result: SerializedEvaluationResult
): EvaluationResult {
  return {
    ...result,
    evaluatedAt: new Date(result.evaluatedAt),
  }
}

export function getCrmStatusLabel(status: CrmEvaluationStatus) {
  return crmStatuses.find((s) => s.value === status)?.label ?? status
}
