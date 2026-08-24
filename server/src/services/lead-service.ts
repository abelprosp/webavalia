import { pool } from '../db/pool.js'
import {
  sanitizeEvaluationResultForPreview,
  sanitizePropertyInputForPreview,
} from '../utils/lead-preview.js'
import {
  formatLeadBudget,
  getListingIntentFromInput,
} from '../utils/rent-estimate.js'

import { LEAD_UNLOCK_CREDIT_COST } from '../constants/pricing.js'

export const LEAD_UNLOCK_COST = LEAD_UNLOCK_CREDIT_COST

export type LeadRow = {
  id: string
  external_id: string | null
  name: string | null
  phone: string
  email: string | null
  property_type: string | null
  interest: string | null
  budget: string | null
  location: string | null
  source: string
  status: string
  property_input: Record<string, unknown> | null
  evaluation_result: Record<string, unknown> | null
  raw_payload: Record<string, unknown>
  opportunity_score: number | null
  appreciation_score: number | null
  created_at: Date | string
}

function maskValue(value: string) {
  if (value.length <= 4) return '****'
  return (
    value.slice(0, 2) +
    '*'.repeat(Math.min(value.length - 4, 8)) +
    value.slice(-2)
  )
}

function mapLeadForUser(
  row: LeadRow,
  unlocked: boolean
) {
  const evaluationResult = row.evaluation_result ?? null
  const propertyInput = row.property_input ?? null
  const listingIntent = getListingIntentFromInput(propertyInput)
  const estimatedValue =
    typeof evaluationResult?.estimatedValue === 'number'
      ? evaluationResult.estimatedValue
      : null
  const displayValue =
    estimatedValue != null
      ? formatLeadBudget(listingIntent, estimatedValue, propertyInput)
      : null
  const publicLocation = row.location ?? '—'
  const previewPropertyInput = unlocked
    ? propertyInput
    : sanitizePropertyInputForPreview(propertyInput, publicLocation) ??
      (evaluationResult
        ? sanitizePropertyInputForPreview(
            {
              listingIntent,
              propertyType: row.property_type ?? 'apartamento',
              area: 70,
              bedrooms: 0,
              bathrooms: 0,
              parking: 0,
              buildingAge: 'mais-10',
              conservation: 'bom',
              standardLevel: 'padrao',
              furnishing: 'sem',
              finishLevel: 'padrao',
              condominiumLevel: 'nao-aplica',
              amenities: [],
            },
            publicLocation
          )
        : null)

  return {
    id: row.id,
    name: unlocked ? (row.name ?? 'Sem nome') : maskValue(row.name ?? 'Lead'),
    phone: unlocked ? row.phone : maskValue(row.phone),
    email: unlocked ? (row.email ?? '') : row.email ? maskValue(row.email) : '',
    propertyType: row.property_type ?? '—',
    interest: row.interest ?? 'Avaliação WhatsApp',
    budget: row.budget ?? '—',
    location: row.location ?? '—',
    source: row.source,
    receivedAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : row.created_at,
    status: unlocked
      ? row.status === 'contatado'
        ? 'contatado'
        : 'desbloqueado'
      : 'novo',
    unlocked,
    listingIntent,
    estimatedValue,
    displayValue,
    hasEvaluation: Boolean(row.evaluation_result),
    opportunityScore:
      row.opportunity_score != null
        ? Number(row.opportunity_score)
        : typeof row.evaluation_result?.opportunityScore === 'number'
          ? row.evaluation_result.opportunityScore
          : null,
    appreciationScore:
      row.appreciation_score != null
        ? Number(row.appreciation_score)
        : typeof row.evaluation_result?.appreciationScore === 'number'
          ? row.evaluation_result.appreciationScore
          : null,
    propertyInput: previewPropertyInput,
    evaluationResult: unlocked
      ? row.evaluation_result
      : sanitizeEvaluationResultForPreview(row.evaluation_result),
  }
}

export async function createLead(input: {
  externalId?: string
  name?: string
  phone: string
  email?: string
  propertyType?: string
  interest?: string
  budget?: string
  location?: string
  source?: string
  propertyInput?: Record<string, unknown>
  evaluationResult?: Record<string, unknown>
  rawPayload?: Record<string, unknown>
  opportunityScore?: number | null
  appreciationScore?: number | null
}) {
  const result = await pool.query<LeadRow>(
    `INSERT INTO leads (
       external_id, name, phone, email, property_type, interest, budget,
       location, source, property_input, evaluation_result, raw_payload,
       opportunity_score, appreciation_score
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, $13, $14)
     ON CONFLICT (external_id) DO NOTHING
     RETURNING *`,
    [
      input.externalId ?? null,
      input.name ?? null,
      input.phone,
      input.email ?? null,
      input.propertyType ?? null,
      input.interest ?? null,
      input.budget ?? null,
      input.location ?? null,
      input.source ?? 'whatsapp',
      input.propertyInput ? JSON.stringify(input.propertyInput) : null,
      input.evaluationResult ? JSON.stringify(input.evaluationResult) : null,
      JSON.stringify(input.rawPayload ?? {}),
      input.opportunityScore ?? null,
      input.appreciationScore ?? null,
    ]
  )

  if (!result.rowCount) {
    const existing = input.externalId
      ? await pool.query<LeadRow>(
          'SELECT * FROM leads WHERE external_id = $1',
          [input.externalId]
        )
      : { rows: [], rowCount: 0 }

    return {
      lead: existing.rows[0] ?? null,
      created: false,
    }
  }

  return { lead: result.rows[0], created: true }
}

const ACTIVE_LEAD_STATUS_FILTER = `l.status <> 'indisponivel'`

export async function getLeadByExternalId(externalId: string) {
  const result = await pool.query<LeadRow>(
    'SELECT * FROM leads WHERE external_id = $1',
    [externalId]
  )
  return result.rows[0] ?? null
}

export async function countLeadUnlocks(leadId: string) {
  const result = await pool.query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM lead_unlocks WHERE lead_id = $1',
    [leadId]
  )
  return Number(result.rows[0]?.count ?? 0)
}

export async function withdrawLead(leadId: string) {
  const result = await pool.query<LeadRow>(
    `UPDATE leads
     SET status = 'indisponivel',
         raw_payload = raw_payload || $2::jsonb
     WHERE id = $1 AND status <> 'indisponivel'
     RETURNING *`,
    [
      leadId,
      JSON.stringify({
        withdrawnAt: new Date().toISOString(),
      }),
    ]
  )

  if (!result.rowCount) {
    const existing = await pool.query<LeadRow>(
      'SELECT * FROM leads WHERE id = $1',
      [leadId]
    )
    if (!existing.rowCount) {
      throw new Error('Lead não encontrado.')
    }
    if (existing.rows[0].status === 'indisponivel') {
      const unlockCount = await countLeadUnlocks(leadId)
      return { lead: existing.rows[0], alreadyWithdrawn: true, unlockCount }
    }
    throw new Error('Lead não encontrado.')
  }

  const unlockCount = await countLeadUnlocks(leadId)
  return { lead: result.rows[0], alreadyWithdrawn: false, unlockCount }
}

export async function reactivateLead(
  leadId: string,
  input: {
    phone: string
    name?: string
    email?: string
    propertyType?: string
    interest?: string
    budget?: string
    location?: string
    propertyInput?: Record<string, unknown>
    evaluationResult?: Record<string, unknown>
    rawPayload?: Record<string, unknown>
    opportunityScore?: number | null
    appreciationScore?: number | null
  }
) {
  const result = await pool.query<LeadRow>(
    `UPDATE leads
     SET status = 'novo',
         phone = $2,
         name = COALESCE($3, name),
         email = COALESCE($4, email),
         property_type = COALESCE($5, property_type),
         interest = COALESCE($6, interest),
         budget = COALESCE($7, budget),
         location = COALESCE($8, location),
         property_input = COALESCE($9::jsonb, property_input),
         evaluation_result = COALESCE($10::jsonb, evaluation_result),
         raw_payload = COALESCE($11::jsonb, raw_payload) || $12::jsonb,
         opportunity_score = COALESCE($13, opportunity_score),
         appreciation_score = COALESCE($14, appreciation_score)
     WHERE id = $1 AND status = 'indisponivel'
     RETURNING *`,
    [
      leadId,
      input.phone,
      input.name ?? null,
      input.email ?? null,
      input.propertyType ?? null,
      input.interest ?? null,
      input.budget ?? null,
      input.location ?? null,
      input.propertyInput ? JSON.stringify(input.propertyInput) : null,
      input.evaluationResult ? JSON.stringify(input.evaluationResult) : null,
      input.rawPayload ? JSON.stringify(input.rawPayload) : null,
      JSON.stringify({
        reactivatedAt: new Date().toISOString(),
      }),
      input.opportunityScore ?? null,
      input.appreciationScore ?? null,
    ]
  )

  if (!result.rowCount) {
    throw new Error('Lead não encontrado ou já está ativo.')
  }

  return result.rows[0]
}

export async function listLeadsForUser(
  userId: string,
  options: { limit?: number; sort?: 'recent' | 'investment' | 'opportunity' } = {}
) {
  const limit = options.limit ?? 50
  const sort = options.sort ?? 'recent'

  const orderBy =
    sort === 'investment'
      ? 'l.appreciation_score DESC NULLS LAST, l.created_at DESC'
      : sort === 'opportunity'
        ? 'l.opportunity_score DESC NULLS LAST, l.created_at DESC'
        : 'l.created_at DESC'

  const result = await pool.query<LeadRow & { unlocked: boolean }>(
    `SELECT l.*, (lu.id IS NOT NULL) AS unlocked
     FROM leads l
     LEFT JOIN lead_unlocks lu
       ON lu.lead_id = l.id AND lu.user_id = $1
     WHERE ${ACTIVE_LEAD_STATUS_FILTER}
     ORDER BY ${orderBy}
     LIMIT $2`,
    [userId, limit]
  )

  return result.rows.map((row) =>
    mapLeadForUser(row, Boolean(row.unlocked))
  )
}

export async function getLeadForUser(userId: string, leadId: string) {
  const result = await pool.query<LeadRow & { unlocked: boolean }>(
    `SELECT l.*, (lu.id IS NOT NULL) AS unlocked
     FROM leads l
     LEFT JOIN lead_unlocks lu
       ON lu.lead_id = l.id AND lu.user_id = $1
     WHERE l.id = $2 AND ${ACTIVE_LEAD_STATUS_FILTER}`,
    [userId, leadId]
  )

  if (!result.rowCount) return null

  const row = result.rows[0]
  return mapLeadForUser(row, Boolean(row.unlocked))
}

export async function unlockLeadForUser(userId: string, leadId: string) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const leadResult = await client.query<LeadRow>(
      'SELECT * FROM leads WHERE id = $1 FOR UPDATE',
      [leadId]
    )

    if (!leadResult.rowCount) {
      throw new Error('Lead não encontrado.')
    }

    if (leadResult.rows[0].status === 'indisponivel') {
      throw new Error('Este imóvel não está mais disponível na plataforma.')
    }

    const existingUnlock = await client.query(
      'SELECT id FROM lead_unlocks WHERE lead_id = $1 AND user_id = $2',
      [leadId, userId]
    )

    if (existingUnlock.rowCount) {
      const balance = await client.query<{ credits: number }>(
        'SELECT credits FROM users WHERE id = $1',
        [userId]
      )
      const credits = balance.rows[0]?.credits ?? 0
      await client.query('COMMIT')
      return {
        lead: mapLeadForUser(leadResult.rows[0], true),
        credits,
        leadCredits: credits,
        alreadyUnlocked: true,
      }
    }

    const userResult = await client.query<{ credits: number }>(
      'SELECT credits FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    )

    if (!userResult.rowCount) {
      throw new Error('Usuário não encontrado.')
    }

    if (userResult.rows[0].credits < LEAD_UNLOCK_COST) {
      const err = new Error(
        `Créditos insuficientes. Necessário ${LEAD_UNLOCK_COST} créditos para desbloquear.`
      ) as Error & { code: string; balance: number }
      err.code = 'INSUFFICIENT_CREDITS'
      err.balance = userResult.rows[0].credits
      throw err
    }

    await client.query(
      `INSERT INTO lead_unlocks (lead_id, user_id, credits_spent)
       VALUES ($1, $2, $3)`,
      [leadId, userId, LEAD_UNLOCK_COST]
    )

    const updatedCredits = await client.query<{ credits: number }>(
      `UPDATE users
       SET credits = credits - $2,
           updated_at = NOW()
       WHERE id = $1 AND credits >= $2
       RETURNING credits`,
      [userId, LEAD_UNLOCK_COST]
    )

    if (!updatedCredits.rowCount) {
      const err = new Error('Créditos insuficientes.') as Error & {
        code: string
      }
      err.code = 'INSUFFICIENT_CREDITS'
      throw err
    }

    await client.query(
      `INSERT INTO credit_transactions (user_id, amount, type, description)
       VALUES ($1, $2, 'lead_unlock', $3)`,
      [userId, -LEAD_UNLOCK_COST, `Desbloqueio do lead ${leadId}`]
    )

    await client.query('COMMIT')

    return {
      lead: mapLeadForUser(leadResult.rows[0], true),
      credits: updatedCredits.rows[0]?.credits ?? 0,
      leadCredits: updatedCredits.rows[0]?.credits ?? 0,
      alreadyUnlocked: false,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function updateLeadStatus(leadId: string, status: 'novo' | 'contatado') {
  const result = await pool.query<LeadRow>(
    `UPDATE leads SET status = $2 WHERE id = $1 RETURNING *`,
    [leadId, status]
  )

  if (!result.rowCount) {
    throw new Error('Lead não encontrado.')
  }

  return result.rows[0]
}
