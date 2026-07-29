import { api } from './api'

export type MarketMapQuery = {
  lat: number
  lng: number
  city: string
  state: string
  propertyType: string
  bedrooms: number
  area: number
  listingIntent?: 'alugar' | 'vender'
}

export type MarketMapResult = {
  valuePerSqm: number
  averagePricePerSqm: number | null
  priceRange: { min: number; max: number } | null
  address: string
  neighborhood: string | null
  score: number
  scoreLabel: string
  comparablesCount: number
  listingIntent: 'alugar' | 'vender'
  lat: number
  lng: number
}

export async function queryMarketMapPoint(
  input: MarketMapQuery
): Promise<MarketMapResult> {
  const { data } = await api.post<MarketMapResult>('/evaluation/market-map', input)
  return data
}
