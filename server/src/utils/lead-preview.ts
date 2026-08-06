const SENSITIVE_PROPERTY_KEYS = [
  'cep',
  'streetNumber',
  'notes',
  'photos',
] as const

export function sanitizePropertyInputForPreview(
  input: Record<string, unknown> | null,
  publicLocation: string
): Record<string, unknown> | null {
  if (!input) return null

  const sanitized = { ...input }
  for (const key of SENSITIVE_PROPERTY_KEYS) {
    delete sanitized[key]
  }
  delete sanitized.address

  return {
    ...sanitized,
    address: publicLocation || 'Localização não informada',
    cep: '',
    streetNumber: '',
  }
}

export function sanitizeEvaluationResultForPreview(
  result: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!result) return null
  return { ...result }
}
