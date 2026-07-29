export type ReverseGeocodeResult = {
  neighborhood: string | null
  city: string | null
  state: string | null
  displayAddress: string
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

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'AvaliaImob/1.0 (market-map; contact@avaliaimob.com.br)',
    },
  })

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
