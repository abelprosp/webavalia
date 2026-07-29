export type MarketCity = {
  label: string
  city: string
  state: string
  lat: number
  lng: number
  zoom: number
}

export const DEFAULT_MARKET_CITY: MarketCity = {
  label: 'São Paulo, SP',
  city: 'São Paulo',
  state: 'SP',
  lat: -23.5505,
  lng: -46.6333,
  zoom: 12,
}
