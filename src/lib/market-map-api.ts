import { api } from './api'

export type MarketMapQuery = {
  lat: number
  lng: number
  city: string
  state: string
  propertyType: string
  bedrooms?: number
  area: number
  listingIntent?: 'alugar' | 'vender'
}

export type MarketCitySearchResult = {
  label: string
  city: string
  state: string
  lat: number
  lng: number
  zoom: number
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

export async function searchMarketCities(
  query: string
): Promise<MarketCitySearchResult[]> {
  const { data } = await api.get<MarketCitySearchResult[]>(
    '/evaluation/market-map/cities',
    { params: { q: query } }
  )
  return data
}
