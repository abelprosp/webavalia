import { pool } from '../db/pool.js'

export const LEAD_UNLOCK_COST = 1

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
  const estimatedValue =
    typeof evaluationResult?.estimatedValue === 'number'
      ? evaluationResult.estimatedValue
      : null

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
    estimatedValue,
    hasEvaluation: Boolean(row.evaluation_result),
    propertyInput: unlocked ? row.property_input : null,
    evaluationResult: unlocked ? row.evaluation_result : null,
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
}) {
  const result = await pool.query<LeadRow>(
    `INSERT INTO leads (
       external_id, name, phone, email, property_type, interest, budget,
       location, source, property_input, evaluation_result, raw_payload
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb)
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

export async function listLeadsForUser(userId: string, limit = 50) {
  const result = await pool.query<LeadRow & { unlocked: boolean }>(
    `SELECT l.*, (lu.id IS NOT NULL) AS unlocked
     FROM leads l
     LEFT JOIN lead_unlocks lu
       ON lu.lead_id = l.id AND lu.user_id = $1
     ORDER BY l.created_at DESC
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
     WHERE l.id = $2`,
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

    const existingUnlock = await client.query(
      'SELECT id FROM lead_unlocks WHERE lead_id = $1 AND user_id = $2',
      [leadId, userId]
    )

    if (existingUnlock.rowCount) {
      await client.query('COMMIT')
      return {
        lead: mapLeadForUser(leadResult.rows[0], true),
        leadCredits: (
          await pool.query<{ lead_credits: number }>(
            'SELECT lead_credits FROM users WHERE id = $1',
            [userId]
          )
        ).rows[0]?.lead_credits ?? 0,
        alreadyUnlocked: true,
      }
    }

    const userResult = await client.query<{ lead_credits: number }>(
      'SELECT lead_credits FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    )

    if (!userResult.rowCount) {
      throw new Error('Usuário não encontrado.')
    }

    if (userResult.rows[0].lead_credits < LEAD_UNLOCK_COST) {
      throw new Error('Créditos insuficientes.')
    }

    await client.query(
      `INSERT INTO lead_unlocks (lead_id, user_id, credits_spent)
       VALUES ($1, $2, $3)`,
      [leadId, userId, LEAD_UNLOCK_COST]
    )

    const updatedCredits = await client.query<{ lead_credits: number }>(
      `UPDATE users
       SET lead_credits = GREATEST(lead_credits - $2, 0),
           updated_at = NOW()
       WHERE id = $1
       RETURNING lead_credits`,
      [userId, LEAD_UNLOCK_COST]
    )

    await client.query(
      `INSERT INTO credit_transactions (user_id, amount, type, description)
       VALUES ($1, $2, 'lead_unlock', $3)`,
      [userId, -LEAD_UNLOCK_COST, `Desbloqueio do lead ${leadId}`]
    )

    await client.query('COMMIT')

    return {
      lead: mapLeadForUser(leadResult.rows[0], true),
      leadCredits: updatedCredits.rows[0]?.lead_credits ?? 0,
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
