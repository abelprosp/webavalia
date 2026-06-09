import { z } from 'zod'
import { buildingAgeOptions, HIGH_END_FURNITURE_AMENITY } from './criteria'

const buildingAgeValues = buildingAgeOptions.map((option) => option.value) as [
  (typeof buildingAgeOptions)[number]['value'],
  ...(typeof buildingAgeOptions)[number]['value'][],
]

export const evaluationFormSchema = z.object({
  cep: z.union([
    z.literal(''),
    z.string().regex(/^\d{5}-?\d{3}$/, 'Informe um CEP válido'),
  ]),
  streetNumber: z.string().optional(),
  address: z.string().min(5, 'Informe o endereço completo'),
  propertyType: z.string().min(1, 'Selecione o tipo de imóvel'),
  area: z.number().min(10, 'Área mínima de 10 m²'),
  lotArea: z.number().min(10, 'Metragem mínima de 10 m²').optional(),
  bedrooms: z.number().min(0),
  bathrooms: z.number().min(0),
  parking: z.number().min(0),
  buildingAge: z.enum(buildingAgeValues, {
    message: 'Selecione a idade da construção',
  }),
  conservation: z.string().min(1, 'Selecione o estado de conservação'),
  standardLevel: z.enum(['padrao', 'alto-padrao', 'luxo']),
  furnishing: z.enum(['sem', 'semi', 'completo']),
  finishLevel: z.enum(['basico', 'padrao', 'alto-padrao', 'luxo']),
  condominiumLevel: z.enum(['nao-aplica', 'padrao', 'alto-padrao', 'clube']),
  viewType: z
    .enum(['nenhuma', 'cidade', 'mar', 'montanha', 'parque', 'lago'])
    .optional(),
  amenities: z.array(z.string()),
  highEndFurnitureValue: z
    .number()
    .min(1, 'Informe o valor estimado dos móveis')
    .optional(),
  askingPrice: z.number().optional(),
  notes: z.string().optional(),
}).superRefine((data, ctx) => {
  if (
    data.amenities.includes(HIGH_END_FURNITURE_AMENITY) &&
    data.highEndFurnitureValue == null
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['highEndFurnitureValue'],
      message: 'Informe o valor estimado de todos os móveis juntos.',
    })
  }
})

export type EvaluationFormValues = z.infer<typeof evaluationFormSchema>

export type ComparableListing = {
  title: string
  price: string
  area?: string
  source: string
  link?: string
}

export type MarketAnalysis = {
  averagePricePerSqm: number | null
  priceRange: { min: number; max: number } | null
  comparables: ComparableListing[]
  summary: string
}

export type MasterPlanAnalysis = {
  zoning: string
  allowedUses: string[]
  restrictions: string[]
  developmentPotential: string
  summary: string
}

export type NbrHomogenizationFactor = {
  id: string
  label: string
  value: number
  justification: string
}

export type NbrHomogenizedComparable = {
  title: string
  source: string
  link?: string
  declaredPrice: string
  area?: string
  areaSqm?: number | null
  unitPriceSqm?: number | null
  factors: NbrHomogenizationFactor[]
  homogenizedUnitPriceSqm: number | null
  weight: number
}

export type Nbr14653Analysis = {
  standard: string
  purpose: string
  referenceDate: string
  specificationGrade: 'I' | 'II' | 'III'
  specificationGradeLabel: string
  maxDeviationPercent: number
  specificationDescription: string
  primaryMethod: {
    id: string
    name: string
    justification: string
  }
  complementaryMethods: Array<{
    id: string
    name: string
    justification: string
    estimatedValue?: number | null
  }>
  homogenizedComparables: NbrHomogenizedComparable[]
  calculationMemory: {
    steps: string[]
    homogenizedAveragePriceSqm: number | null
    adjustmentsApplied: string[]
    finalValue: number
    valuePerSqm: number
  }
  limitations: string[]
  disclaimer: string
}

export type EvaluationResult = {
  estimatedValue: number
  valuePerSqm: number
  score: number
  scoreLabel: string
  criteriaScores: { id: string; label: string; score: number; weight: number }[]
  aiInsights: string[]
  marketAnalysis: MarketAnalysis
  masterPlanAnalysis: MasterPlanAnalysis
  nbr14653?: Nbr14653Analysis
  photoPreviews: string[]
  photoCount: number
  evaluatedAt: Date
  sources?: {
    marketResultsCount: number
    masterPlanResultsCount: number
  }
}

export function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}
