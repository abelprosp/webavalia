import {
  DEFAULT_EVALUATION_FORM_VALUES,
  type EvaluationFormValues,
} from '../data/evaluation-engine'

function normalizeDraftValues(values: EvaluationFormValues) {
  return {
    ...values,
    cep: values.cep ?? '',
    streetNumber: values.streetNumber ?? '',
    notes: values.notes ?? '',
    amenities: values.amenities ?? [],
  }
}

export function isDraftWorthy(values: EvaluationFormValues) {
  return (
    JSON.stringify(normalizeDraftValues(values)) !==
    JSON.stringify(normalizeDraftValues(DEFAULT_EVALUATION_FORM_VALUES))
  )
}
