import { config } from '../config.js'

export type SerperResult = {
  title: string
  link: string
  snippet: string
}

export type SerperSearchResponse = {
  organic: SerperResult[]
}

export async function serperSearch(query: string, num = 8): Promise<SerperResult[]> {
  if (!config.serperApiKey) {
    return []
  }

  const response = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': config.serperApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: query,
      gl: 'br',
      hl: 'pt-br',
      num,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Serper API error: ${response.status} ${text}`)
  }

  const data = (await response.json()) as SerperSearchResponse
  return data.organic ?? []
}

export function extractLocationHint(address: string) {
  const parts = address
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  if (parts.length >= 2) {
    return parts.slice(-2).join(', ')
  }

  return address.trim()
}

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartamento: 'apartamento',
  casa: 'casa',
  cobertura: 'cobertura',
  terreno: 'terreno',
  comercial: 'imóvel comercial',
}

export async function searchMarketListings(
  address: string,
  propertyType: string,
  area: number
) {
  const location = extractLocationHint(address)
  const typeLabel = PROPERTY_TYPE_LABELS[propertyType] ?? propertyType

  const queries = [
    `${typeLabel} venda ${location} site:zapimoveis.com.br OR site:vivareal.com.br`,
    `${typeLabel} ${area}m² venda ${location} preço`,
    `preço m² ${typeLabel} ${location}`,
  ]

  const results = await Promise.all(queries.map((q) => serperSearch(q, 6)))
  const seen = new Set<string>()
  const merged: SerperResult[] = []

  for (const batch of results) {
    for (const item of batch) {
      if (!seen.has(item.link)) {
        seen.add(item.link)
        merged.push(item)
      }
    }
  }

  return merged.slice(0, 15)
}

export async function searchMasterPlan(address: string) {
  const location = extractLocationHint(address)

  const queries = [
    `plano diretor ${location} zoneamento uso do solo`,
    `plano diretor municipal ${location} coeficiente aproveitamento`,
    `lei de zoneamento urbano ${location} bairro`,
  ]

  const results = await Promise.all(queries.map((q) => serperSearch(q, 6)))
  const seen = new Set<string>()
  const merged: SerperResult[] = []

  for (const batch of results) {
    for (const item of batch) {
      if (!seen.has(item.link)) {
        seen.add(item.link)
        merged.push(item)
      }
    }
  }

  return merged.slice(0, 12)
}
