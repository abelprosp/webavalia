export type MarketCity = {
  label: string
  city: string
  state: string
  lat: number
  lng: number
  zoom: number
}

export const MARKET_CITIES: MarketCity[] = [
  { label: 'São Paulo, SP', city: 'São Paulo', state: 'SP', lat: -23.5505, lng: -46.6333, zoom: 12 },
  { label: 'Rio de Janeiro, RJ', city: 'Rio de Janeiro', state: 'RJ', lat: -22.9068, lng: -43.1729, zoom: 12 },
  { label: 'Belo Horizonte, MG', city: 'Belo Horizonte', state: 'MG', lat: -19.9167, lng: -43.9345, zoom: 12 },
  { label: 'Curitiba, PR', city: 'Curitiba', state: 'PR', lat: -25.4284, lng: -49.2733, zoom: 12 },
  { label: 'Porto Alegre, RS', city: 'Porto Alegre', state: 'RS', lat: -30.0346, lng: -51.2177, zoom: 12 },
  { label: 'Brasília, DF', city: 'Brasília', state: 'DF', lat: -15.7942, lng: -47.8822, zoom: 12 },
  { label: 'Salvador, BA', city: 'Salvador', state: 'BA', lat: -12.9714, lng: -38.5014, zoom: 12 },
  { label: 'Fortaleza, CE', city: 'Fortaleza', state: 'CE', lat: -3.7172, lng: -38.5433, zoom: 12 },
  { label: 'Recife, PE', city: 'Recife', state: 'PE', lat: -8.0476, lng: -34.877, zoom: 12 },
  { label: 'Florianópolis, SC', city: 'Florianópolis', state: 'SC', lat: -27.5954, lng: -48.548, zoom: 12 },
  { label: 'Campinas, SP', city: 'Campinas', state: 'SP', lat: -22.9056, lng: -47.0608, zoom: 12 },
  { label: 'Goiânia, GO', city: 'Goiânia', state: 'GO', lat: -16.6869, lng: -49.2648, zoom: 12 },
]

export const DEFAULT_MARKET_CITY = MARKET_CITIES[0]!
