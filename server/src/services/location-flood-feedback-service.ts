import { pool } from '../db/pool.js'
import type { FloodRiskAnalysis } from '../types/advanced-analysis.js'
import { extractLocationHint } from './serper.js'

export type FloodSeverity = 'baixo' | 'moderado' | 'alto'

export type LocationFloodKnowledge = {
  gotWater: boolean
  severity: FloodSeverity | null
  comments: string[]
  reportCount: number
  latestAt: string
  source: 'address' | 'neighborhood'
}

function stripDiacritics(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function normalizeAddressKey(address: string) {
  return stripDiacritics(address)
    .toLowerCase()
    .replace(/\b\d{5}-?\d{3}\b/g, '')
    .replace(/[^a-z0-9,\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function buildAddressKeys(address: string) {
  const trimmed = address.trim()
  const parts = trimmed
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const cityState = extractLocationHint(trimmed)
  const neighborhood = parts.length >= 3 ? parts[parts.length - 3] : parts[0] ?? ''

  return {
    addressKey: normalizeAddressKey(trimmed),
    neighborhoodKey: normalizeAddressKey(
      neighborhood ? `${neighborhood}, ${cityState}` : cityState
    ),
    display: trimmed,
  }
}

function riskLabel(level: FloodSeverity) {
  switch (level) {
    case 'baixo':
      return 'Baixo'
    case 'moderado':
      return 'Moderado'
    case 'alto':
      return 'Alto'
  }
}

function impactForLevel(level: FloodSeverity) {
  switch (level) {
    case 'alto':
      return 'Risco hídrico elevado confirmado por relatos locais — pode reduzir liquidez e exigir desconto.'
    case 'moderado':
      return 'Risco hídrico moderado confirmado por relatos locais — influencia negociações em chuvas intensas.'
    case 'baixo':
      return 'Risco hídrico baixo confirmado por relatos locais — alagamentos pontuais ou leves.'
  }
}

export function floodAnalysisFromKnowledge(
  knowledge: LocationFloodKnowledge
): FloodRiskAnalysis | null {
  if (!knowledge.gotWater) return null

  const severity = knowledge.severity ?? 'baixo'
  const userNotes = knowledge.comments.filter(Boolean)

  return {
    riskLevel: severity,
    riskLevelLabel: riskLabel(severity),
    floodQuota: null,
    historicalEvents:
      userNotes.length > 0
        ? userNotes.slice(0, 3)
        : [`Relato confirmado por ${knowledge.reportCount} usuário(s) da plataforma.`],
    affectedAreas: [],
    mitigationMeasures: [],
    impactOnValue: impactForLevel(severity),
    summary:
      userNotes.length > 0
        ? `Informação confirmada por usuários locais: ${userNotes[0]}`
        : `Informação confirmada por ${knowledge.reportCount} relato(s) de usuários sobre alagamento neste endereço.`,
  }
}

type FloodFeedbackRow = {
  got_water: boolean
  severity: FloodSeverity | null
  comment: string | null
  created_at: string
}

async function loadFeedbackForKey(key: string) {
  const result = await pool.query<FloodFeedbackRow>(
    `SELECT got_water, severity, comment, created_at
     FROM location_flood_feedback
     WHERE address_key = $1
     ORDER BY created_at DESC
     LIMIT 10`,
    [key]
  )
  return result.rows
}

function aggregateFeedback(
  rows: FloodFeedbackRow[],
  source: LocationFloodKnowledge['source']
): LocationFloodKnowledge | null {
  if (rows.length === 0) return null

  const latest = rows[0]
  const recent = rows.slice(0, 5)
  const gotWaterVotes = recent.filter((r) => r.got_water).length
  const noWaterVotes = recent.length - gotWaterVotes

  let gotWater = latest.got_water
  if (gotWaterVotes > 0 && noWaterVotes > 0 && recent.length >= 2) {
    gotWater = gotWaterVotes >= noWaterVotes
  }

  let severity: FloodSeverity | null = null
  if (gotWater) {
    const severityVotes = recent
      .filter((r) => r.got_water && r.severity)
      .map((r) => r.severity as FloodSeverity)

    if (severityVotes.length > 0) {
      const scores = { baixo: 1, moderado: 2, alto: 3 } as const
      const avg =
        severityVotes.reduce((sum, s) => sum + scores[s], 0) / severityVotes.length
      severity = avg >= 2.5 ? 'alto' : avg >= 1.5 ? 'moderado' : 'baixo'
    } else if (latest.severity) {
      severity = latest.severity
    } else {
      severity = 'baixo'
    }
  }

  return {
    gotWater,
    severity,
    comments: recent.map((r) => r.comment?.trim() ?? '').filter(Boolean),
    reportCount: rows.length,
    latestAt: latest.created_at,
    source,
  }
}

export async function getLocationFloodKnowledge(
  address: string
): Promise<LocationFloodKnowledge | null> {
  const keys = buildAddressKeys(address)

  const addressRows = await loadFeedbackForKey(keys.addressKey)
  const addressKnowledge = aggregateFeedback(addressRows, 'address')
  if (addressKnowledge) return addressKnowledge

  if (keys.neighborhoodKey && keys.neighborhoodKey !== keys.addressKey) {
    const neighborhoodRows = await loadFeedbackForKey(keys.neighborhoodKey)
    const neighborhoodKnowledge = aggregateFeedback(neighborhoodRows, 'neighborhood')
    if (neighborhoodKnowledge && neighborhoodKnowledge.reportCount >= 2) {
      return neighborhoodKnowledge
    }
  }

  return null
}

export function formatLocationFloodKnowledgeForPrompt(
  knowledge: LocationFloodKnowledge,
  address: string
) {
  const lines = [
    `Endereço consultado: ${address}`,
    `Fonte: ${knowledge.source === 'address' ? 'relatos do mesmo endereço' : 'relatos do bairro'}`,
    `Total de relatos: ${knowledge.reportCount}`,
    knowledge.gotWater
      ? `Usuários confirmaram ALAGAMENTO — severidade: ${knowledge.severity ?? 'baixo'}`
      : 'Usuários confirmaram que NÃO alaga / nunca pegou água',
  ]

  if (knowledge.comments.length > 0) {
    lines.push('Detalhes informados pelos usuários:')
    knowledge.comments.slice(0, 5).forEach((c, i) => lines.push(`${i + 1}. ${c}`))
  }

  return lines.join('\n')
}

export async function submitLocationFloodFeedback(input: {
  userId: string
  evaluationId?: string
  address: string
  gotWater: boolean
  severity?: FloodSeverity | null
  comment?: string
}) {
  const keys = buildAddressKeys(input.address)
  const severity = input.gotWater ? (input.severity ?? 'baixo') : null
  const comment = input.comment?.trim() || null

  if (input.evaluationId) {
    const owner = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM property_evaluations WHERE id = $1`,
      [input.evaluationId]
    )
    if (!owner.rowCount || owner.rows[0].user_id !== input.userId) {
      throw new Error('Avaliação não encontrada.')
    }
  }

  await pool.query(
    `INSERT INTO location_flood_feedback
      (user_id, evaluation_id, address_key, address_display, got_water, severity, comment)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      input.userId,
      input.evaluationId ?? null,
      keys.addressKey,
      keys.display,
      input.gotWater,
      severity,
      comment,
    ]
  )

  const knowledge = await getLocationFloodKnowledge(input.address)
  return {
    knowledge,
    floodRiskAnalysis: knowledge ? floodAnalysisFromKnowledge(knowledge) : null,
  }
}
