import { describe, expect, it } from 'vitest'
import {
  DEFAULT_EVALUATION_FORM_VALUES,
  evaluationFormSchema,
  normalizeEvaluationResult,
} from './evaluation-engine'

describe('floor evaluation criteria', () => {
  const valid = {
    ...DEFAULT_EVALUATION_FORM_VALUES,
    address: 'Rua Exemplo, 100',
    floor: 0,
  }
  it('accepts ground floor and unknown elevator access', () => {
    expect(evaluationFormSchema.safeParse(valid).success).toBe(true)
  })
  it('rejects floor above the building and fractional room counts', () => {
    expect(
      evaluationFormSchema.safeParse({ ...valid, floor: 8, totalFloors: 7 })
        .success
    ).toBe(false)
    expect(
      evaluationFormSchema.safeParse({ ...valid, bedrooms: 1.5 }).success
    ).toBe(false)
  })
  it('requires floor for commercial units', () => {
    expect(
      evaluationFormSchema.safeParse({
        ...valid,
        propertyType: 'comercial',
        floor: undefined,
      }).success
    ).toBe(false)
  })
  it('rejects contradictory elevator information', () => {
    expect(
      evaluationFormSchema.safeParse({
        ...valid,
        elevatorAccess: 'nao',
        amenities: ['elevador'],
      }).success
    ).toBe(false)
  })
})

it('preserves computed radar scores when normalizing persisted evaluations', () => {
  const result = normalizeEvaluationResult({
    estimatedValue: 450000,
    evaluatedAt: new Date(),
    finishScore: 84,
    opportunityScore: 67,
  })
  expect(result.finishScore).toBe(84)
  expect(result.opportunityScore).toBe(67)
})
