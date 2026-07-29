export type ReverseGeocodeResult = {
  neighborhood: string | null
  city: string | null
  state: string | null
  displayAddress: string
}

export type CitySearchResult = {
  label: string
  city: string
  state: string
  lat: number
  lng: number
  zoom: number
}

const NOMINATIM_HEADERS = {
  'User-Agent': 'AvaliaImob/1.0 (market-map; contact@avaliaimob.com.br)',
}

const EXCLUDED_PLACE_CLASSES = new Set([
  'shop',
  'amenity',
  'tourism',
  'highway',
  'building',
  'leisure',
  'office',
])

const STATE_NAME_TO_UF: Record<string, string> = {
  Acre: 'AC',
  Alagoas: 'AL',
  Amapá: 'AP',
  Amazonas: 'AM',
  Bahia: 'BA',
  Ceará: 'CE',
  'Distrito Federal': 'DF',
  'Espírito Santo': 'ES',
  Goiás: 'GO',
  Maranhão: 'MA',
  'Mato Grosso': 'MT',
  'Mato Grosso do Sul': 'MS',
  'Minas Gerais': 'MG',
  Pará: 'PA',
  Paraíba: 'PB',
  Paraná: 'PR',
  Pernambuco: 'PE',
  Piauí: 'PI',
  'Rio de Janeiro': 'RJ',
  'Rio Grande do Norte': 'RN',
  'Rio Grande do Sul': 'RS',
  Rondônia: 'RO',
  Roraima: 'RR',
  'Santa Catarina': 'SC',
  'São Paulo': 'SP',
  Sergipe: 'SE',
  Tocantins: 'TO',
}

function extractStateCode(address: Record<string, string>): string | null {
  const iso = address['ISO3166-2-l6']
  if (iso?.includes('-')) {
    return iso.split('-')[1]?.toUpperCase() ?? null
  }

  const stateName = address.state?.trim()
  if (stateName) {
    if (stateName.length === 2) return stateName.toUpperCase()
    return STATE_NAME_TO_UF[stateName] ?? null
  }

  return null
}

function extractCityName(address: Record<string, string>): string | null {
  return (
    address.city ??
    address.town ??
    address.municipality ??
    address.village ??
    address.county ??
    null
  )
}

function mapNominatimItem(item: {
  lat: string
  lon: string
  class?: string
  address?: Record<string, string>
}): CitySearchResult | null {
  const addr = item.address ?? {}
  const city = extractCityName(addr)
  const state = extractStateCode(addr)

  if (!city || !state) return null
  if (EXCLUDED_PLACE_CLASSES.has(item.class ?? '')) return null

  return {
    label: `${city}, ${state}`,
    city,
    state,
    lat: Number(item.lat),
    lng: Number(item.lon),
    zoom: 13,
  }
}

export async function searchCities(query: string): Promise<CitySearchResult[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', `${trimmed}, Brasil`)
  url.searchParams.set('format', 'json')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('countrycodes', 'br')
  url.searchParams.set('limit', '15')
  url.searchParams.set('accept-language', 'pt-BR')

  const response = await fetch(url.toString(), { headers: NOMINATIM_HEADERS })

  if (!response.ok) {
    throw new Error('Falha ao buscar cidades.')
  }

  const data = (await response.json()) as Array<{
    lat: string
    lon: string
    type?: string
    class?: string
    display_name?: string
    address?: Record<string, string>
  }>

  const seen = new Set<string>()
  const results: CitySearchResult[] = []

  for (const item of data) {
    const mapped = mapNominatimItem(item)
    if (!mapped) continue

    const key = mapped.label.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    results.push(mapped)
  }

  return results
}

export async function geocodeCep(cep: string): Promise<CitySearchResult & { cep: string }> {
  const digits = cep.replace(/\D/g, '')
  if (digits.length !== 8) {
    throw new Error('CEP inválido.')
  }

  const viaCepResponse = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
  if (!viaCepResponse.ok) {
    throw new Error('Falha ao consultar CEP.')
  }

  const viaCep = (await viaCepResponse.json()) as {
    cep?: string
    localidade?: string
    uf?: string
    bairro?: string
    erro?: boolean
  }

  if (viaCep.erro || !viaCep.localidade || !viaCep.uf) {
    throw new Error('CEP não encontrado.')
  }

  const city = viaCep.localidade
  const state = viaCep.uf.toUpperCase()
  const searchQuery = viaCep.bairro
    ? `${viaCep.bairro}, ${city}, ${state}, Brasil`
    : `${city}, ${state}, Brasil`

  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', searchQuery)
  url.searchParams.set('format', 'json')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('countrycodes', 'br')
  url.searchParams.set('limit', '1')
  url.searchParams.set('accept-language', 'pt-BR')

  const response = await fetch(url.toString(), { headers: NOMINATIM_HEADERS })
  if (!response.ok) {
    throw new Error('Falha ao localizar CEP no mapa.')
  }

  const data = (await response.json()) as Array<{ lat: string; lon: string }>

  if (data.length > 0) {
    return {
      label: viaCep.bairro ? `${viaCep.bairro}, ${city}, ${state}` : `${city}, ${state}`,
      city,
      state,
      lat: Number(data[0]!.lat),
      lng: Number(data[0]!.lon),
      zoom: 15,
      cep: viaCep.cep ?? digits,
    }
  }

  const fallback = await searchCities(`${city}, ${state}`)
  const match = fallback.find(
    (item) =>
      item.city.toLowerCase() === city.toLowerCase() &&
      item.state.toUpperCase() === state
  )

  if (!match) {
    throw new Error('Não foi possível centralizar o mapa neste CEP.')
  }

  return {
    ...match,
    label: viaCep.bairro ? `${viaCep.bairro}, ${city}, ${state}` : match.label,
    zoom: 14,
    cep: viaCep.cep ?? digits,
  }
}

export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<ReverseGeocodeResult> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse')
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lng))
  url.searchParams.set('format', 'json')
  url.searchParams.set('accept-language', 'pt-BR')
  url.searchParams.set('addressdetails', '1')

  const response = await fetch(url.toString(), { headers: NOMINATIM_HEADERS })

  if (!response.ok) {
    throw new Error('Falha ao identificar localização no mapa.')
  }

  const data = (await response.json()) as {
    address?: Record<string, string>
  }

  const addr = data.address ?? {}
  const neighborhood =
    addr.suburb ??
    addr.neighbourhood ??
    addr.quarter ??
    addr.city_district ??
    addr.residential ??
    null
  const city = addr.city ?? addr.town ?? addr.municipality ?? null
  const state = extractStateCode(addr)

  const displayAddress = neighborhood
    ? `${neighborhood}${city ? `, ${city}` : ''}${state ? ` — ${state}` : ''}`
    : city
      ? `${city}${state ? ` — ${state}` : ''}`
      : 'Região selecionada'

  return { neighborhood, city, state, displayAddress }
}

export function composeMarketMapAddress(input: {
  neighborhood: string | null
  city: string
  state: string
}) {
  const neighborhood = input.neighborhood?.trim() || 'Região selecionada'
  return `${neighborhood}, ${input.city} — ${input.state.toUpperCase()}`
}
