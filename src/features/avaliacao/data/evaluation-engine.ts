import { z } from 'zod'
import { buildingAgeOptions, HIGH_END_FURNITURE_AMENITY } from './criteria'

const buildingAgeValues = buildingAgeOptions.map((option) => option.value) as [
  (typeof buildingAgeOptions)[number]['value'],
  ...(typeof buildingAgeOptions)[number]['value'][],
]

export const listingIntentValues = ['alugar', 'vender'] as const
export type ListingIntent = (typeof listingIntentValues)[number]

export const LISTING_INTENT_OPTIONS: Array<{
  value: ListingIntent
  label: string
  description: string
}> = [
  {
    value: 'alugar',
    label: 'Alugar',
    description: 'Estimativa de aluguel mensal com base no mercado',
  },
  {
    value: 'vender',
    label: 'Vender',
    description: 'Valor de venda estimado para o imóvel',
  },
]

export function getListingIntentLabel(intent: ListingIntent) {
  return LISTING_INTENT_OPTIONS.find((option) => option.value === intent)?.label ?? intent
}

const MONTHLY_YIELD_BY_STANDARD: Record<
  'padrao' | 'alto-padrao' | 'luxo',
  number
> = {
  padrao: 0.005,
  'alto-padrao': 0.0045,
  luxo: 0.004,
}

export function estimateMonthlyRent(
  estimatedValue: number,
  property: { area: number; standardLevel: 'padrao' | 'alto-padrao' | 'luxo' }
) {
  const monthlyYield =
    MONTHLY_YIELD_BY_STANDARD[property.standardLevel] ?? 0.005
  const monthlyRent = Math.round(estimatedValue * monthlyYield)
  const rentPerSqm = Math.round(monthlyRent / property.area)
  const annualYieldPercent = monthlyYield * 12 * 100

  return { monthlyRent, rentPerSqm, annualYieldPercent, monthlyYield }
}

export const evaluationFormSchema = z.object({
  listingIntent: z.enum(listingIntentValues, {
    message: 'Selecione se deseja alugar ou vender',
  }),
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

export const DEFAULT_EVALUATION_FORM_VALUES: EvaluationFormValues = {
  listingIntent: 'vender',
  cep: '',
  streetNumber: '',
  address: '',
  propertyType: 'apartamento',
  area: 70,
  lotArea: undefined,
  bedrooms: 2,
  bathrooms: 1,
  parking: 1,
  buildingAge: 'mais-10',
  conservation: 'bom',
  standardLevel: 'padrao',
  furnishing: 'sem',
  finishLevel: 'padrao',
  condominiumLevel: 'nao-aplica',
  viewType: undefined,
  amenities: [],
  highEndFurnitureValue: undefined,
  askingPrice: undefined,
  notes: '',
}

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

export type SaleScenarioId = 'rapida' | 'moderada' | 'lenta'

export type SaleScenario = {
  id: SaleScenarioId
  label: string
  description: string
  timeframe: string
  value: number
  valuePerSqm: number
  adjustmentPercent: number
}

const SALE_SCENARIO_ADJUSTMENTS: Record<SaleScenarioId, number> = {
  rapida: -0.1,
  moderada: 0,
  lenta: 0.08,
}

const SALE_SCENARIO_META: Record<
  SaleScenarioId,
  { label: string; description: string; timeframe: string }
> = {
  rapida: {
    label: 'Venda rápida',
    description: 'Preço mais agressivo para atrair compradores',
    timeframe: '30–60 dias',
  },
  moderada: {
    label: 'Venda moderada',
    description: 'Valor alinhado ao mercado',
    timeframe: '3–6 meses',
  },
  lenta: {
    label: 'Venda lenta',
    description: 'Preço otimista — exige mais tempo no mercado',
    timeframe: '6+ meses',
  },
}

export function computeSaleScenarios(
  estimatedValue: number,
  area: number
): SaleScenario[] {
  const safeArea = area > 0 ? area : 1

  return (Object.keys(SALE_SCENARIO_ADJUSTMENTS) as SaleScenarioId[]).map(
    (id) => {
      const adjustmentPercent = SALE_SCENARIO_ADJUSTMENTS[id]
      const value = Math.round(estimatedValue * (1 + adjustmentPercent))
      const meta = SALE_SCENARIO_META[id]

      return {
        id,
        label: meta.label,
        description: meta.description,
        timeframe: meta.timeframe,
        value,
        valuePerSqm: Math.round(value / safeArea),
        adjustmentPercent: adjustmentPercent * 100,
      }
    }
  )
}

export type NeighborhoodAnalysis = {
  overview: string
  infrastructure: string[]
  services: string[]
  mobility: string[]
  safetyPerception: string
  qualityOfLife: string
  highlights: string[]
  concerns: string[]
  summary: string
}

export type FloodRiskAnalysis = {
  riskLevel: 'baixo' | 'moderado' | 'alto' | 'indeterminado'
  riskLevelLabel: string
  historicalEvents: string[]
  affectedAreas: string[]
  mitigationMeasures: string[]
  impactOnValue: string
  summary: string
}

export type MarketAppreciationAnalysis = {
  trend: 'valorizacao' | 'estavel' | 'desvalorizacao' | 'indeterminado'
  trendLabel: string
  annualGrowthEstimatePercent: number | null
  historicalContext: string
  demandLevel: string
  liquidity: string
  priceTrendFactors: string[]
  projectionSummary: string
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
  neighborhoodAnalysis?: NeighborhoodAnalysis
  floodRiskAnalysis?: FloodRiskAnalysis
  marketAppreciationAnalysis?: MarketAppreciationAnalysis
  nbr14653?: Nbr14653Analysis
  saleScenarios?: SaleScenario[]
  photoPreviews: string[]
  photoCount: number
  evaluatedAt: Date
  sources?: {
    marketResultsCount: number
    masterPlanResultsCount: number
    neighborhoodResultsCount?: number
    floodResultsCount?: number
    appreciationResultsCount?: number
  }
}

export function getSaleScenarios(
  result: Pick<EvaluationResult, 'estimatedValue' | 'saleScenarios'>,
  area: number
) {
  return result.saleScenarios ?? computeSaleScenarios(result.estimatedValue, area)
}

export function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}
