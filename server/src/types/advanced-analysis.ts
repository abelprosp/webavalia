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
