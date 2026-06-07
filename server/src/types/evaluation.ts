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

export type EvaluationAIResponse = {
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
