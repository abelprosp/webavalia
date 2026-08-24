import { pool } from '../db/pool.js'
import { config } from '../config.js'
import { serperSearch, type SerperResult } from './serper.js'
import { runPropertyEvaluation } from './evaluation-service.js'
import { resolveMarketMapPricing } from '../utils/market-map-pricing.js'
import {
  MARKET_MAP_DEFAULT_AREA,
  MARKET_MAP_EVALUATION_DEFAULTS,
} from '../constants/evaluation-defaults.js'
import { CreditsExhaustedError } from './trial-service.js'

export type CaptureOpportunity = {
  id: string
  searchKey: string
  title: string
  propertyType: string | null
  priceCents: number | null
  area: number | null
  location: string | null
  sourceUrl: string
  sourcePortal: string | null
  ownerSignal: boolean
  marketValueCents: number | null
  discountPercent: number | null
  opportunityScore: number | null
  status: 'nova' | 'abordada' | 'descartada' | 'no_crm'
  approachMessage: string | null
  rawSnippet: string | null
  createdAt: string
  expiresAt: string
}

export type RadarScanInput = {
  userId: string
  city: string
  state: string
  neighborhood?: string
  propertyType: string
  listingIntent: 'vender' | 'alugar'
}

const RADAR_MARKET_CACHE_DAYS = 7

const RADAR_TYPE_LABELS: Record<string, string> = {
  apartamento: 'apartamento',
  casa: 'casa',
  'casa-condominio': 'casa em condomínio',
  'casa-geminada': 'casa geminada',
  cobertura: 'cobertura',
  studio: 'studio',
  kitnet: 'kitnet',
  sobrado: 'sobrado',
  terreno: 'terreno',
  lote: 'terreno lote',
  chacara: 'chácara',
  sitio: 'sítio',
  comercial: 'sala comercial',
  loja: 'loja',
  galpao: 'galpão',
  'galpao-industrial': 'pavilhão',
}

function getTypeLabel(propertyType: string) {
  return RADAR_TYPE_LABELS[propertyType] ?? propertyType.replace(/-/g, ' ')
}

export function buildSearchKey(input: {
  city: string
  state: string
  neighborhood?: string
  propertyType: string
  listingIntent: string
}) {
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

  return [
    normalize(input.city),
    input.state.toLowerCase(),
    input.neighborhood ? normalize(input.neighborhood) : 'geral',
    normalize(input.propertyType),
    input.listingIntent,
  ].join(':')
}

function detectPortal(url: string): string | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    if (host.includes('olx')) return 'OLX'
    if (host.includes('zapimoveis')) return 'Zap Imóveis'
    if (host.includes('vivareal')) return 'VivaReal'
    if (host.includes('imovelweb')) return 'Imovelweb'
    if (host.includes('chavesnamao')) return 'Chaves na Mão'
    if (host.includes('mercadolivre') || host.includes('mercadolibre'))
      return 'Mercado Livre'
    return host
  } catch {
    return null
  }
}

/** Reserva 1 crédito para a varredura do radar (mesmo saldo unificado). */
export async function reserveCreditForRadarScan(userId: string) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const locked = await client.query<{ credits: number }>(
      'SELECT credits FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    )

    if (!locked.rowCount) {
      throw new Error('Usuário não encontrado.')
    }

    if (locked.rows[0].credits <= 0) {
      throw new CreditsExhaustedError()
    }

    const updated = await client.query<{ credits: number }>(
      `UPDATE users
       SET credits = credits - 1, updated_at = NOW()
       WHERE id = $1
       RETURNING credits`,
      [userId]
    )

    await client.query(
      `INSERT INTO credit_transactions (user_id, amount, type, description)
       VALUES ($1, -1, 'radar_scan', 'Varredura do Radar de Captação IA')`,
      [userId]
    )

    await client.query('COMMIT')
    return updated.rows[0].credits
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function refundCreditForRadarScan(userId: string) {
  await pool.query(
    `UPDATE users SET credits = credits + 1, updated_at = NOW() WHERE id = $1`,
    [userId]
  )
  await pool.query(
    `INSERT INTO credit_transactions (user_id, amount, type, description)
     VALUES ($1, 1, 'radar_scan_refund', 'Estorno de varredura do radar com falha')`,
    [userId]
  )
}

async function searchOwnerListings(input: RadarScanInput): Promise<SerperResult[]> {
  const typeLabel = getTypeLabel(input.propertyType)
  const place = [input.neighborhood, input.city, input.state]
    .filter(Boolean)
    .join(' ')
  const intent = input.listingIntent === 'alugar' ? 'alugar' : 'venda'

  const queries = [
    `site:olx.com.br ${typeLabel} ${intent} ${place} "direto com proprietário"`,
    `site:olx.com.br ${typeLabel} ${intent} ${place} particular`,
    `site:zapimoveis.com.br ${typeLabel} ${intent} ${place} proprietário`,
    `site:vivareal.com.br ${typeLabel} ${intent} ${place} "direto com proprietário"`,
    `${typeLabel} ${intent} ${place} "direto com o proprietário" -imobiliária`,
  ]

  const settled = await Promise.allSettled(
    queries.map((query) => serperSearch(query, 10))
  )

  const seen = new Set<string>()
  const results: SerperResult[] = []
  for (const outcome of settled) {
    if (outcome.status !== 'fulfilled') continue
    for (const item of outcome.value) {
      if (!item.link || seen.has(item.link)) continue
      seen.add(item.link)
      results.push(item)
    }
  }
  return results
}

type ExtractedListing = {
  title: string
  url: string
  propertyType: string | null
  price: number | null
  area: number | null
  location: string | null
  ownerSignal: boolean
  snippet: string
}

async function extractListingsWithAI(
  results: SerperResult[],
  input: RadarScanInput
): Promise<ExtractedListing[]> {
  if (results.length === 0) return []
  if (!config.openaiApiKey) {
    // Fallback sem IA: usa dados brutos dos snippets.
    return results.map((item) => ({
      title: item.title,
      url: item.link,
      propertyType: input.propertyType,
      price: null,
      area: null,
      location: null,
      ownerSignal: /propriet|particular/i.test(`${item.title} ${item.snippet}`),
      snippet: item.snippet,
    }))
  }

  const payload = results.slice(0, 40).map((item, index) => ({
    index,
    title: item.title,
    url: item.link,
    snippet: item.snippet,
  }))

  const systemPrompt = `Você extrai dados estruturados de anúncios imobiliários a partir de resultados de busca do Google.
Responda APENAS JSON válido no formato:
{"listings":[{"index":0,"title":"...","propertyType":"apartamento","price":350000,"area":72,"location":"Bairro, Cidade","ownerSignal":true,"isListing":true}]}

Regras:
- "price": preço TOTAL em reais (número, sem centavos). null se não identificável. Ignore valores de condomínio/IPTU.
- "area": área útil em m². null se não identificável.
- "ownerSignal": true se o anúncio parece ser direto do proprietário/particular (sem imobiliária/corretor).
- "isListing": false se o resultado NÃO é um anúncio de um imóvel específico (ex.: página de listagem geral, notícia, blog).
- Considere apenas imóveis compatíveis com tipo "${getTypeLabel(input.propertyType)}" na região de ${input.neighborhood ? `${input.neighborhood}, ` : ''}${input.city}/${input.state}.
- Se incompatível com a região ou tipo, marque "isListing": false.`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.openaiModel,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(payload) },
      ],
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`OpenAI radar extraction error: ${response.status} ${text}`)
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = data.choices?.[0]?.message?.content
  if (!content) return []

  let parsed: {
    listings?: Array<{
      index?: number
      title?: string
      propertyType?: string | null
      price?: number | null
      area?: number | null
      location?: string | null
      ownerSignal?: boolean
      isListing?: boolean
    }>
  }
  try {
    parsed = JSON.parse(content)
  } catch {
    return []
  }

  const listings: ExtractedListing[] = []
  for (const item of parsed.listings ?? []) {
    if (item.isListing === false) continue
    const source =
      typeof item.index === 'number' ? payload[item.index] : undefined
    if (!source) continue
    listings.push({
      title: (item.title || source.title).slice(0, 480),
      url: source.url,
      propertyType: item.propertyType ?? input.propertyType,
      price:
        typeof item.price === 'number' && item.price > 10_000 ? item.price : null,
      area: typeof item.area === 'number' && item.area >= 10 ? item.area : null,
      location: item.location ?? null,
      ownerSignal: Boolean(item.ownerSignal),
      snippet: source.snippet,
    })
  }
  return listings
}

/** Preço/m² da região com cache de 7 dias por search_key (corta a call mais cara). */
async function resolveRegionValuePerSqm(
  input: RadarScanInput,
  searchKey: string
): Promise<number | null> {
  const cached = await pool.query<{ value_per_sqm: string }>(
    `SELECT value_per_sqm FROM radar_market_cache
     WHERE search_key = $1 AND created_at > NOW() - INTERVAL '${RADAR_MARKET_CACHE_DAYS} days'`,
    [searchKey]
  )
  if (cached.rowCount) {
    const value = Number(cached.rows[0].value_per_sqm)
    return value > 0 ? value : null
  }

  if (!config.openaiApiKey) return null

  try {
    const address = [input.neighborhood, `${input.city} - ${input.state}`]
      .filter(Boolean)
      .join(', ')

    const result = await runPropertyEvaluation({
      ...MARKET_MAP_EVALUATION_DEFAULTS,
      address,
      propertyType: input.propertyType,
      area: MARKET_MAP_DEFAULT_AREA,
      bedrooms: 2,
      listingIntent: input.listingIntent,
    })

    const pricing = resolveMarketMapPricing(result, {
      requestedArea: MARKET_MAP_DEFAULT_AREA,
      propertyType: input.propertyType,
    })

    if (pricing.valuePerSqm > 0) {
      await pool.query(
        `INSERT INTO radar_market_cache (search_key, value_per_sqm, created_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (search_key)
         DO UPDATE SET value_per_sqm = EXCLUDED.value_per_sqm, created_at = NOW()`,
        [searchKey, pricing.valuePerSqm]
      )
      return pricing.valuePerSqm
    }
    return null
  } catch (error) {
    console.error('[radar] falha ao estimar preço de mercado da região:', error)
    return null
  }
}

function computeOpportunityScore(item: {
  ownerSignal: boolean
  discountPercent: number | null
  hasPrice: boolean
  hasArea: boolean
}) {
  let score = 40
  if (item.ownerSignal) score += 25
  if (item.hasPrice) score += 5
  if (item.hasArea) score += 5
  if (item.discountPercent != null) {
    // Desconto vs mercado vale até 25 pontos (5% = ~8pts, 15%+ = 25pts).
    score += Math.max(0, Math.min(25, Math.round(item.discountPercent * 1.7)))
  }
  return Math.max(0, Math.min(100, score))
}

function mapOpportunity(row: Record<string, unknown>): CaptureOpportunity {
  return {
    id: String(row.id),
    searchKey: String(row.search_key),
    title: String(row.title),
    propertyType: row.property_type ? String(row.property_type) : null,
    priceCents: row.price_cents != null ? Number(row.price_cents) : null,
    area: row.area != null ? Number(row.area) : null,
    location: row.location ? String(row.location) : null,
    sourceUrl: String(row.source_url),
    sourcePortal: row.source_portal ? String(row.source_portal) : null,
    ownerSignal: Boolean(row.owner_signal),
    marketValueCents:
      row.market_value_cents != null ? Number(row.market_value_cents) : null,
    discountPercent:
      row.discount_percent != null ? Number(row.discount_percent) : null,
    opportunityScore:
      row.opportunity_score != null ? Number(row.opportunity_score) : null,
    status: String(row.status) as CaptureOpportunity['status'],
    approachMessage: row.approach_message ? String(row.approach_message) : null,
    rawSnippet: row.raw_snippet ? String(row.raw_snippet) : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    expiresAt: new Date(String(row.expires_at)).toISOString(),
  }
}

export async function runCaptureRadarScan(input: RadarScanInput) {
  const searchKey = buildSearchKey(input)

  const [serperResults, valuePerSqm] = await Promise.all([
    searchOwnerListings(input),
    resolveRegionValuePerSqm(input, searchKey),
  ])

  const listings = await extractListingsWithAI(serperResults, input)

  for (const listing of listings) {
    const marketValueCents =
      valuePerSqm != null && listing.area != null
        ? Math.round(valuePerSqm * listing.area * 100)
        : null
    const priceCents = listing.price != null ? listing.price * 100 : null

    let discountPercent: number | null = null
    if (marketValueCents != null && priceCents != null && marketValueCents > 0) {
      discountPercent =
        Math.round(((marketValueCents - priceCents) / marketValueCents) * 1000) /
        10
    }

    const score = computeOpportunityScore({
      ownerSignal: listing.ownerSignal,
      discountPercent,
      hasPrice: priceCents != null,
      hasArea: listing.area != null,
    })

    await pool.query(
      `INSERT INTO capture_opportunities (
         user_id, search_key, title, property_type, price_cents, area,
         location, source_url, source_portal, owner_signal,
         market_value_cents, discount_percent, opportunity_score, raw_snippet,
         expires_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, NOW() + INTERVAL '7 days')
       ON CONFLICT (user_id, source_url) DO UPDATE SET
         search_key = EXCLUDED.search_key,
         title = EXCLUDED.title,
         price_cents = COALESCE(EXCLUDED.price_cents, capture_opportunities.price_cents),
         area = COALESCE(EXCLUDED.area, capture_opportunities.area),
         market_value_cents = COALESCE(EXCLUDED.market_value_cents, capture_opportunities.market_value_cents),
         discount_percent = COALESCE(EXCLUDED.discount_percent, capture_opportunities.discount_percent),
         opportunity_score = EXCLUDED.opportunity_score,
         expires_at = NOW() + INTERVAL '7 days'`,
      [
        input.userId,
        searchKey,
        listing.title,
        listing.propertyType,
        priceCents,
        listing.area,
        listing.location ??
          [input.neighborhood, input.city].filter(Boolean).join(', '),
        listing.url,
        detectPortal(listing.url),
        listing.ownerSignal,
        marketValueCents,
        discountPercent,
        score,
        listing.snippet,
      ]
    )
  }

  const opportunities = await pool.query<Record<string, unknown>>(
    `SELECT * FROM capture_opportunities
     WHERE user_id = $1 AND search_key = $2
       AND status != 'descartada' AND expires_at > NOW()
     ORDER BY opportunity_score DESC NULLS LAST, created_at DESC`,
    [input.userId, searchKey]
  )

  return {
    searchKey,
    regionValuePerSqm: valuePerSqm,
    found: listings.length,
    opportunities: opportunities.rows.map(mapOpportunity),
  }
}

export async function listCaptureOpportunities(
  userId: string,
  filters: { status?: string; search?: string } = {}
) {
  const conditions = ['user_id = $1', "expires_at > NOW()"]
  const params: unknown[] = [userId]

  if (filters.status) {
    params.push(filters.status)
    conditions.push(`status = $${params.length}`)
  } else {
    conditions.push("status != 'descartada'")
  }

  if (filters.search) {
    params.push(`%${filters.search}%`)
    conditions.push(
      `(title ILIKE $${params.length} OR location ILIKE $${params.length})`
    )
  }

  const result = await pool.query<Record<string, unknown>>(
    `SELECT * FROM capture_opportunities
     WHERE ${conditions.join(' AND ')}
     ORDER BY opportunity_score DESC NULLS LAST, created_at DESC
     LIMIT 200`,
    params
  )

  return result.rows.map(mapOpportunity)
}

export async function getCaptureOpportunity(userId: string, id: string) {
  const result = await pool.query<Record<string, unknown>>(
    `SELECT * FROM capture_opportunities WHERE id = $1 AND user_id = $2`,
    [id, userId]
  )
  return result.rowCount ? mapOpportunity(result.rows[0]!) : null
}

export async function updateCaptureOpportunityStatus(
  userId: string,
  id: string,
  status: 'nova' | 'abordada' | 'descartada' | 'no_crm'
) {
  const result = await pool.query<Record<string, unknown>>(
    `UPDATE capture_opportunities
     SET status = $1
     WHERE id = $2 AND user_id = $3
     RETURNING *`,
    [status, id, userId]
  )
  return result.rowCount ? mapOpportunity(result.rows[0]!) : null
}

function formatBrl(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

/** Gera mensagem WhatsApp consultiva citando a avaliação de mercado da região. */
export async function generateApproachMessage(
  userId: string,
  opportunityId: string,
  brokerName: string | null
) {
  const opportunity = await getCaptureOpportunity(userId, opportunityId)
  if (!opportunity) {
    throw new Error('Oportunidade não encontrada.')
  }

  if (!config.openaiApiKey) {
    throw new Error('Serviço de IA indisponível.')
  }

  const facts: string[] = [
    `Anúncio: ${opportunity.title}`,
    opportunity.location ? `Local: ${opportunity.location}` : null,
    opportunity.priceCents != null
      ? `Preço anunciado: ${formatBrl(opportunity.priceCents)}`
      : null,
    opportunity.area != null ? `Área: ${opportunity.area} m²` : null,
    opportunity.marketValueCents != null
      ? `Valor de mercado estimado pela Avalia Imobe: ${formatBrl(opportunity.marketValueCents)}`
      : null,
    opportunity.discountPercent != null
      ? `Diferença vs mercado: ${opportunity.discountPercent > 0 ? `${opportunity.discountPercent}% abaixo` : `${Math.abs(opportunity.discountPercent)}% acima`} do mercado`
      : null,
  ].filter((item): item is string => Boolean(item))

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.openaiModel,
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Você escreve mensagens curtas de WhatsApp para corretores de imóveis abordarem proprietários que anunciaram o imóvel por conta própria.
Regras:
- Tom consultivo e respeitoso, nunca insistente. Português brasileiro.
- Máximo 4 frases curtas. Sem emojis em excesso (no máximo 1).
- Cite um dado concreto de valor de mercado da região quando disponível (gera credibilidade).
- Ofereça uma avaliação profissional gratuita como porta de entrada.
- Nunca invente dados que não foram fornecidos.
- Responda JSON: {"message":"..."}`,
        },
        {
          role: 'user',
          content: `Corretor: ${brokerName ?? 'corretor parceiro'}\n${facts.join('\n')}`,
        },
      ],
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`OpenAI approach error: ${response.status} ${text}`)
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = data.choices?.[0]?.message?.content
  let message: string | null
  try {
    message = content ? String(JSON.parse(content).message ?? '') : null
  } catch {
    message = content ?? null
  }

  if (!message) {
    throw new Error('Não foi possível gerar a mensagem de abordagem.')
  }

  await pool.query(
    `UPDATE capture_opportunities SET approach_message = $1 WHERE id = $2 AND user_id = $3`,
    [message, opportunityId, userId]
  )

  return { ...opportunity, approachMessage: message }
}
