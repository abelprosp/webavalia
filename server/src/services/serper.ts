import { config } from '../config.js'
import type { EvaluationRequest } from '../types/evaluation.js'
import { isLandOnlyPropertyType } from '../constants/evaluation-defaults.js'
import {
  extractCityFromAddress,
  extractCityStateHint,
  extractLocationHint,
  extractNeighborhoodFromAddress,
} from '../utils/address-parsing.js'
import { filterComparablesByNeighborhood } from '../utils/comparable-location-filter.js'

export { extractLocationHint } from '../utils/address-parsing.js'

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

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  apartamento: 'apartamento',
  casa: 'casa',
  'casa-condominio': 'casa em condomínio',
  cobertura: 'cobertura',
  studio: 'studio',
  kitnet: 'kitnet',
  loft: 'loft',
  flat: 'flat',
  duplex: 'duplex',
  triplex: 'triplex',
  sobrado: 'sobrado',
  terreno: 'terreno',
  lote: 'lote terreno',
  chacara: 'chácara',
  sitio: 'sítio',
  fazenda: 'fazenda',
  comercial: 'sala comercial',
  loja: 'loja',
  'ponto-comercial': 'ponto comercial',
  galpao: 'galpão',
  deposito: 'depósito armazém',
  'predio-comercial': 'prédio comercial',
  consultorio: 'consultório',
  'andar-corporativo': 'andar corporativo',
  hotel: 'hotel',
  pousada: 'pousada',
  restaurante: 'restaurante bar',
  'galpao-industrial': 'galpão industrial',
  'terreno-industrial': 'terreno industrial',
  'area-industrial': 'área industrial',
  garagem: 'vaga garagem',
  edicula: 'edícula',
  barracao: 'barracão',
  misto: 'imóvel misto',
}

function getPremiumSearchHint(input: EvaluationRequest) {
  if (input.standardLevel === 'luxo' || input.finishLevel === 'luxo') {
    return 'luxo alto padrão'
  }
  if (input.standardLevel === 'alto-padrao' || input.finishLevel === 'alto-padrao') {
    return 'alto padrão'
  }
  return ''
}

export async function searchMarketListings(input: EvaluationRequest) {
  const cityState = extractCityStateHint(input.address)
  const neighborhood = extractNeighborhoodFromAddress(input.address)
  const location = extractLocationHint(input.address)
  const typeLabel =
    PROPERTY_TYPE_LABELS[input.propertyType] ?? input.propertyType
  const premiumHint = getPremiumSearchHint(input)
  const premiumPrefix = premiumHint ? `${premiumHint} ` : ''
  const furnishedHint =
    input.furnishing === 'completo'
      ? 'mobiliado '
      : input.furnishing === 'semi'
        ? 'semi mobiliado '
        : ''
  const isLand = isLandOnlyPropertyType(input.propertyType)

  const neighborhoodQueries = neighborhood
    ? [
        `${premiumPrefix}${furnishedHint}${typeLabel} venda bairro ${neighborhood} ${cityState} site:zapimoveis.com.br OR site:vivareal.com.br`,
        `${premiumPrefix}${typeLabel} ${input.area}m² venda ${neighborhood} ${cityState}`,
        `preço m² ${premiumPrefix}${typeLabel} ${neighborhood} ${cityState}`,
        ...(isLand
          ? [
              `terreno lote ${neighborhood} ${cityState} venda preço`,
              `lote ${input.area}m² ${neighborhood} ${cityState} à venda`,
            ]
          : []),
      ]
    : []

  const cityWideQueries = [
    `${premiumPrefix}${furnishedHint}${typeLabel} venda ${cityState} site:zapimoveis.com.br OR site:vivareal.com.br`,
    `${premiumPrefix}${typeLabel} ${input.area}m² venda ${location} preço`,
    `preço m² ${premiumPrefix}${typeLabel} ${cityState}`,
  ]

  const queries = [...neighborhoodQueries, ...cityWideQueries]

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

  const { filtered } = filterComparablesByNeighborhood(
    merged.slice(0, 20),
    input.address,
    { propertyType: input.propertyType }
  )

  return filtered.slice(0, 15)
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

function mergeSerperResults(batches: SerperResult[][], limit: number) {
  const seen = new Set<string>()
  const merged: SerperResult[] = []

  for (const batch of batches) {
    for (const item of batch) {
      if (!seen.has(item.link)) {
        seen.add(item.link)
        merged.push(item)
      }
    }
  }

  return merged.slice(0, limit)
}

export async function searchNeighborhoodProfile(address: string) {
  const neighborhood = extractNeighborhoodFromAddress(address)
  const city = extractCityFromAddress(address)
  const cityState = extractCityStateHint(address)
  const location = neighborhood
    ? `${neighborhood}, ${cityState}`
    : extractLocationHint(address)

  const queries = [
    `bairro ${location} infraestrutura escolas hospitais transporte`,
    `${location} segurança qualidade de vida morar`,
    `${location} comércio serviços metrô ônibus acesso`,
    `perfil socioeconômico bairro ${location}`,
    ...(neighborhood && city
      ? [`${neighborhood} ${city} características imóveis mercado`]
      : []),
  ]

  const results = await Promise.all(queries.map((q) => serperSearch(q, 5)))
  return mergeSerperResults(results, 14)
}

export async function searchFloodRisk(address: string) {
  const location = extractLocationHint(address)
  const neighborhood =
    extractNeighborhoodFromAddress(address) ?? extractLocationHint(address)

  const queries = [
    `cota de cheia ${location} mapa inundação ANA`,
    `enchente alagamento ${neighborhood} ${location} histórico`,
    `área alagável ${location} defesa civil prefeitura mapa risco`,
    `cheia ${location} rio nível cota histórico`,
    `alagamento bairro ${neighborhood} ${location} chuva registro`,
    `risco hídrico ${location} zoneamento inundação`,
  ]

  const results = await Promise.all(queries.map((q) => serperSearch(q, 5)))
  return mergeSerperResults(results, 16)
}

export async function searchMarketAppreciation(
  input: EvaluationRequest
) {
  const location = extractLocationHint(input.address)
  const typeLabel =
    PROPERTY_TYPE_LABELS[input.propertyType] ?? input.propertyType

  const queries = [
    `valorização imóveis ${location} tendência preços`,
    `preço m² ${typeLabel} ${location} histórico valorização`,
    `mercado imobiliário ${location} alta queda preços`,
    `investimento imobiliário ${location} liquidez demanda`,
  ]

  const results = await Promise.all(queries.map((q) => serperSearch(q, 5)))
  return mergeSerperResults(results, 12)
}
