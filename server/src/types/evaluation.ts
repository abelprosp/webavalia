export type EvaluationCriteriaInput = {
  address: string
  propertyType: string
  area: number
  bedrooms: number
  bathrooms: number
  parking: number
  yearBuilt: number
  conservation: string
  standardLevel: 'padrao' | 'alto-padrao' | 'luxo'
  furnishing: 'sem' | 'semi' | 'completo'
  finishLevel: 'basico' | 'padrao' | 'alto-padrao' | 'luxo'
  condominiumLevel: 'nao-aplica' | 'padrao' | 'alto-padrao' | 'clube'
  viewType?: 'nenhuma' | 'cidade' | 'mar' | 'montanha' | 'parque' | 'lago'
  amenities?: string[]
  askingPrice?: number
  notes?: string
}

export type PhotoInput = {
  mimeType: string
  data: string
}

export type EvaluationRequest = EvaluationCriteriaInput & {
  photos?: PhotoInput[]
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

export type Nbr14653Draft = {
  purpose: string
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

export type Nbr14653Analysis = Nbr14653Draft & {
  standard: string
  referenceDate: string
  specificationGrade: 'I' | 'II' | 'III'
  specificationGradeLabel: string
  maxDeviationPercent: number
  specificationDescription: string
}

type EvaluationAIBase = {
  estimatedValue: number
  valuePerSqm: number
  score: number
  scoreLabel: string
  criteriaScores: {
    id: string
    label: string
    score: number
    weight: number
  }[]
  aiInsights: string[]
  marketAnalysis: MarketAnalysis
  masterPlanAnalysis: MasterPlanAnalysis
}

export type EvaluationAIDraftResponse = EvaluationAIBase & {
  nbr14653: Nbr14653Draft
}

export type EvaluationAIResponse = EvaluationAIBase & {
  nbr14653: Nbr14653Analysis
}
