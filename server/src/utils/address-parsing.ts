function normalizeToken(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

export function parseBrazilianAddress(address: string) {
  const trimmed = address.trim()
  if (!trimmed) {
    return {
      street: null as string | null,
      neighborhood: null as string | null,
      city: null as string | null,
      state: null as string | null,
    }
  }

  let streetPart: string | null = null
  let localityPart = trimmed

  if (trimmed.includes('—')) {
    const dashParts = trimmed
      .split('—')
      .map((part) => part.trim())
      .filter(Boolean)
    if (dashParts.length >= 2) {
      streetPart = dashParts[0] ?? null
      localityPart = dashParts.slice(1).join(' — ')
    }
  }

  const commaParts = localityPart
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  if (commaParts.length === 0) {
    return { street: streetPart, neighborhood: null, city: null, state: null }
  }

  const lastPart = commaParts[commaParts.length - 1] ?? ''
  const cityStateMatch = lastPart.match(/^(.+?)\s*-\s*([A-Za-z]{2})$/)

  let city: string | null = null
  let state: string | null = null
  let neighborhood: string | null = null

  if (cityStateMatch) {
    city = cityStateMatch[1]?.trim() ?? null
    state = cityStateMatch[2]?.toUpperCase() ?? null

    if (commaParts.length >= 2) {
      neighborhood = commaParts[commaParts.length - 2] ?? null
    }
  } else if (commaParts.length >= 3 && lastPart.length === 2) {
    state = lastPart.toUpperCase()
    city = commaParts[commaParts.length - 2] ?? null
    neighborhood = commaParts[commaParts.length - 3] ?? null
  } else if (commaParts.length === 2 && cityStateMatch == null) {
    neighborhood = commaParts[0] ?? null
  }

  if (!neighborhood && !streetPart && commaParts.length >= 3) {
    const trailingCityState = commaParts[commaParts.length - 1]?.match(
      /^(.+?)\s*-\s*([A-Za-z]{2})$/
    )
    if (trailingCityState) {
      city = trailingCityState[1]?.trim() ?? city
      state = trailingCityState[2]?.toUpperCase() ?? state
      neighborhood = commaParts[commaParts.length - 2] ?? null
    }
  }

  return { street: streetPart, neighborhood, city, state }
}

export function extractNeighborhoodFromAddress(address: string) {
  return parseBrazilianAddress(address).neighborhood
}

export function extractCityFromAddress(address: string) {
  return parseBrazilianAddress(address).city
}

export function extractLocationHint(address: string) {
  const { city, state, neighborhood } = parseBrazilianAddress(address)

  if (city && state) {
    const cityState = `${city} - ${state}`
    return neighborhood ? `${neighborhood}, ${cityState}` : cityState
  }

  const parts = address
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length >= 2) {
    return parts.slice(-2).join(', ')
  }

  return address.trim()
}

export function extractCityStateHint(address: string) {
  const { city, state } = parseBrazilianAddress(address)
  if (city && state) return `${city} - ${state}`

  const parts = address
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length >= 1) return parts[parts.length - 1] ?? address.trim()
  return address.trim()
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function extractNeighborhoodFromListing(
  text: string,
  cityHint?: string | null
) {
  const trimmed = text.trim()
  if (!trimmed) return null

  if (cityHint) {
    const escapedCity = escapeRegex(cityHint)
    const patterns = [
      new RegExp(
        `-\\s*([^,-]+?)\\s*-\\s*${escapedCity}\\s*/\\s*[A-Za-z]{2}\\s*$`,
        'i'
      ),
      new RegExp(
        `-\\s*([^,-]+?)\\s*-\\s*${escapedCity}(?:\\s*[-/]\\s*[A-Za-z]{2})`,
        'i'
      ),
      new RegExp(
        `\\b${escapedCity}\\s*/\\s*[A-Za-z]{2}[^,-]*-\\s*([^,-]+?)\\s*$`,
        'i'
      ),
    ]

    for (const pattern of patterns) {
      const match = trimmed.match(pattern)
      if (match?.[1]) return match[1].trim()
    }
  }

  const genericMatch = trimmed.match(
    /-\s*([A-Za-zÀ-ú0-9\s.'"]+?)\s*-\s*[A-Za-zÀ-ú\s]+\s*(?:\/|\s*-\s*)[A-Za-z]{2}\s*$/i
  )
  if (genericMatch?.[1]) return genericMatch[1].trim()

  return null
}

export type NeighborhoodMatchResult = 'same' | 'different' | 'unknown'

export function classifyComparableNeighborhood(
  text: string,
  propertyAddress: string
): NeighborhoodMatchResult {
  const propertyNeighborhood = extractNeighborhoodFromAddress(propertyAddress)
  if (!propertyNeighborhood) return 'unknown'

  const city = extractCityFromAddress(propertyAddress)
  const normalizedTarget = normalizeToken(propertyNeighborhood)
  const normalizedText = normalizeToken(text)

  if (normalizedText.includes(normalizedTarget)) return 'same'

  const listingNeighborhood = extractNeighborhoodFromListing(text, city)
  if (!listingNeighborhood) return 'unknown'

  return normalizeToken(listingNeighborhood) === normalizedTarget
    ? 'same'
    : 'different'
}

export function isComparableInSameNeighborhood(
  text: string,
  propertyAddress: string
) {
  const match = classifyComparableNeighborhood(text, propertyAddress)
  return match === 'same' || match === 'unknown'
}

export function isStrictNeighborhoodMismatch(
  text: string,
  propertyAddress: string
) {
  return classifyComparableNeighborhood(text, propertyAddress) === 'different'
}
