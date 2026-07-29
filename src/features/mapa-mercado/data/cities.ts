export type MarketCity = {
  label: string
  city: string
  state: string
  lat: number
  lng: number
  zoom: number
}

export const DEFAULT_MARKET_CITY: MarketCity = {
  label: 'Lajeado, RS',
  city: 'Lajeado',
  state: 'RS',
  lat: -29.4674,
  lng: -51.9619,
  zoom: 13,
}
