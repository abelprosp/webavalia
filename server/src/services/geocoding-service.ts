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

function extractStateCode(address: Record<string, string>): string | null {
  const iso = address['ISO3166-2-l6']
  if (iso?.includes('-')) {
    return iso.split('-')[1]?.toUpperCase() ?? null
  }
  return null
}

function extractCityName(address: Record<string, string>): string | null {
  return (
    address.city ??
    address.town ??
    address.municipality ??
    address.village ??
    null
  )
}

export async function searchCities(query: string): Promise<CitySearchResult[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', trimmed)
  url.searchParams.set('format', 'json')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('countrycodes', 'br')
  url.searchParams.set('limit', '12')
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
    const addr = item.address ?? {}
    const city = extractCityName(addr)
    const state = extractStateCode(addr)

    if (!city || !state) continue
    if (EXCLUDED_PLACE_CLASSES.has(item.class ?? '')) continue

    const key = `${city}-${state}`.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    results.push({
      label: `${city}, ${state}`,
      city,
      state,
      lat: Number(item.lat),
      lng: Number(item.lon),
      zoom: 12,
    })
  }

  return results
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
  const state = addr['ISO3166-2-l6']?.split('-')[1] ?? null

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
