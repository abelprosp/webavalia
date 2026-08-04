import { pool } from '../db/pool.js'

type StoredJson = Record<string, unknown>

function asRecord(value: unknown): StoredJson {
  return typeof value === 'object' && value !== null ? (value as StoredJson) : {}
}

function extractAddress(propertyInput: StoredJson) {
  const address = propertyInput.address
  return typeof address === 'string' ? address.trim() : '—'
}

function extractPropertyType(propertyInput: StoredJson) {
  const type = propertyInput.propertyType
  return typeof type === 'string' ? type : null
}

function extractEstimatedValue(evaluationResult: StoredJson) {
  const value = evaluationResult.estimatedValue
  return typeof value === 'number' ? value : null
}

function extractScore(evaluationResult: StoredJson) {
  const score = evaluationResult.score
  return typeof score === 'number' ? score : null
}

function extractFloodRiskLevel(evaluationResult: StoredJson) {
  const flood = asRecord(evaluationResult.floodRiskAnalysis)
  const level = flood.riskLevel
  return typeof level === 'string' ? level : null
}

export type AdminEvaluationListItem = {
  id: string
  userId: string
  userName: string
  userEmail: string
  accountType: string
  address: string
  propertyType: string | null
  estimatedValue: number | null
  score: number | null
  floodRiskLevel: string | null
  hasEvaluationFeedback: boolean
  evaluationFeedbackRating: 'good' | 'bad' | null
  floodFeedbackCount: number
  createdAt: string
}

export type AdminEvaluationDetail = AdminEvaluationListItem & {
  propertyInput: StoredJson
  evaluationResult: StoredJson
  evaluationFeedback: {
    id: string
    rating: 'good' | 'bad'
    comment: string
    createdAt: string
  } | null
  floodFeedbacks: {
    id: string
    userId: string
    userName: string
    userEmail: string
    gotWater: boolean
    severity: 'baixo' | 'moderado' | 'alto' | null
    comment: string | null
    addressDisplay: string
    createdAt: string
  }[]
}

export type AdminFeedbackListItem = {
  id: string
  type: 'evaluation' | 'flood'
  createdAt: string
  userId: string
  userName: string
  userEmail: string
  evaluationId: string | null
  address: string | null
  rating: 'good' | 'bad' | null
  gotWater: boolean | null
  severity: 'baixo' | 'moderado' | 'alto' | null
  comment: string | null
}

function mapEvaluationRow(row: {
  id: string
  user_id: string
  user_name: string
  user_email: string
  account_type: string
  property_input: StoredJson
  evaluation_result: StoredJson
  created_at: string
  feedback_rating: 'good' | 'bad' | null
  flood_feedback_count: string
}): AdminEvaluationListItem {
  const propertyInput = asRecord(row.property_input)
  const evaluationResult = asRecord(row.evaluation_result)

  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    userEmail: row.user_email,
    accountType: row.account_type,
    address: extractAddress(propertyInput),
    propertyType: extractPropertyType(propertyInput),
    estimatedValue: extractEstimatedValue(evaluationResult),
    score: extractScore(evaluationResult),
    floodRiskLevel: extractFloodRiskLevel(evaluationResult),
    hasEvaluationFeedback: row.feedback_rating != null,
    evaluationFeedbackRating: row.feedback_rating,
    floodFeedbackCount: Number(row.flood_feedback_count ?? 0),
    createdAt: row.created_at,
  }
}

export async function listAdminEvaluations(input: {
  search?: string
  limit?: number
  offset?: number
}) {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100)
  const offset = Math.max(input.offset ?? 0, 0)
  const conditions: string[] = []
  const params: unknown[] = []

  if (input.search?.trim()) {
    params.push(`%${input.search.trim()}%`)
    conditions.push(
      `(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR pe.property_input->>'address' ILIKE $${params.length})`
    )
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const countResult = await pool.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total
     FROM property_evaluations pe
     JOIN users u ON u.id = pe.user_id
     ${where}`,
    params
  )

  params.push(limit, offset)
  const result = await pool.query<{
    id: string
    user_id: string
    user_name: string
    user_email: string
    account_type: string
    property_input: StoredJson
    evaluation_result: StoredJson
    created_at: string
    feedback_rating: 'good' | 'bad' | null
    flood_feedback_count: string
  }>(
    `SELECT
       pe.id,
       pe.user_id,
       u.name AS user_name,
       u.email AS user_email,
       u.account_type,
       pe.property_input,
       pe.evaluation_result,
       pe.created_at,
       ef.rating AS feedback_rating,
       (
         SELECT COUNT(*)::text
         FROM location_flood_feedback lf
         WHERE lf.evaluation_id = pe.id
       ) AS flood_feedback_count
     FROM property_evaluations pe
     JOIN users u ON u.id = pe.user_id
     LEFT JOIN evaluation_feedback ef ON ef.evaluation_id = pe.id
     ${where}
     ORDER BY pe.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )

  return {
    total: Number(countResult.rows[0]?.total ?? 0),
    evaluations: result.rows.map(mapEvaluationRow),
  }
}

export async function getAdminEvaluationById(id: string) {
  const result = await pool.query<{
    id: string
    user_id: string
    user_name: string
    user_email: string
    account_type: string
    property_input: StoredJson
    evaluation_result: StoredJson
    created_at: string
    feedback_rating: 'good' | 'bad' | null
    flood_feedback_count: string
  }>(
    `SELECT
       pe.id,
       pe.user_id,
       u.name AS user_name,
       u.email AS user_email,
       u.account_type,
       pe.property_input,
       pe.evaluation_result,
       pe.created_at,
       ef.rating AS feedback_rating,
       (
         SELECT COUNT(*)::text
         FROM location_flood_feedback lf
         WHERE lf.evaluation_id = pe.id
       ) AS flood_feedback_count
     FROM property_evaluations pe
     JOIN users u ON u.id = pe.user_id
     LEFT JOIN evaluation_feedback ef ON ef.evaluation_id = pe.id
     WHERE pe.id = $1`,
    [id]
  )

  if (!result.rowCount) return null

  const base = mapEvaluationRow(result.rows[0])

  const feedbackResult = await pool.query<{
    id: string
    rating: 'good' | 'bad'
    comment: string
    created_at: string
  }>(
    `SELECT id, rating, comment, created_at
     FROM evaluation_feedback
     WHERE evaluation_id = $1`,
    [id]
  )

  const floodResult = await pool.query<{
    id: string
    user_id: string
    user_name: string
    user_email: string
    got_water: boolean
    severity: 'baixo' | 'moderado' | 'alto' | null
    comment: string | null
    address_display: string
    created_at: string
  }>(
    `SELECT
       lf.id,
       lf.user_id,
       u.name AS user_name,
       u.email AS user_email,
       lf.got_water,
       lf.severity,
       lf.comment,
       lf.address_display,
       lf.created_at
     FROM location_flood_feedback lf
     JOIN users u ON u.id = lf.user_id
     WHERE lf.evaluation_id = $1
     ORDER BY lf.created_at DESC`,
    [id]
  )

  return {
    ...base,
    propertyInput: asRecord(result.rows[0].property_input),
    evaluationResult: asRecord(result.rows[0].evaluation_result),
    evaluationFeedback: feedbackResult.rows[0]
      ? {
          id: feedbackResult.rows[0].id,
          rating: feedbackResult.rows[0].rating,
          comment: feedbackResult.rows[0].comment,
          createdAt: feedbackResult.rows[0].created_at,
        }
      : null,
    floodFeedbacks: floodResult.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      userName: row.user_name,
      userEmail: row.user_email,
      gotWater: row.got_water,
      severity: row.severity,
      comment: row.comment,
      addressDisplay: row.address_display,
      createdAt: row.created_at,
    })),
  } satisfies AdminEvaluationDetail
}

export async function listAdminFeedbacks(input: { limit?: number; offset?: number }) {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100)
  const offset = Math.max(input.offset ?? 0, 0)

  const result = await pool.query<{
    id: string
    type: 'evaluation' | 'flood'
    created_at: string
    sort_at: string
    user_id: string
    user_name: string
    user_email: string
    evaluation_id: string | null
    address: string | null
    rating: 'good' | 'bad' | null
    got_water: boolean | null
    severity: 'baixo' | 'moderado' | 'alto' | null
    comment: string | null
  }>(
    `SELECT * FROM (
       SELECT
         ef.id,
         'evaluation'::text AS type,
         ef.created_at AS created_at,
         ef.created_at AS sort_at,
         ef.user_id,
         u.name AS user_name,
         u.email AS user_email,
         ef.evaluation_id,
         pe.property_input->>'address' AS address,
         ef.rating,
         NULL::boolean AS got_water,
         NULL::varchar AS severity,
         ef.comment
       FROM evaluation_feedback ef
       JOIN users u ON u.id = ef.user_id
       LEFT JOIN property_evaluations pe ON pe.id = ef.evaluation_id

       UNION ALL

       SELECT
         lf.id,
         'flood'::text AS type,
         lf.created_at AS created_at,
         lf.created_at AS sort_at,
         lf.user_id,
         u.name AS user_name,
         u.email AS user_email,
         lf.evaluation_id,
         lf.address_display AS address,
         NULL::varchar AS rating,
         lf.got_water,
         lf.severity,
         lf.comment
       FROM location_flood_feedback lf
       JOIN users u ON u.id = lf.user_id
     ) combined
     ORDER BY sort_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  )

  const countResult = await pool.query<{ total: string }>(
    `SELECT (
       (SELECT COUNT(*) FROM evaluation_feedback) +
       (SELECT COUNT(*) FROM location_flood_feedback)
     )::text AS total`
  )

  return {
    total: Number(countResult.rows[0]?.total ?? 0),
    feedbacks: result.rows.map((row) => ({
      id: row.id,
      type: row.type,
      createdAt: row.created_at,
      userId: row.user_id,
      userName: row.user_name,
      userEmail: row.user_email,
      evaluationId: row.evaluation_id,
      address: row.address,
      rating: row.rating,
      gotWater: row.got_water,
      severity: row.severity,
      comment: row.comment,
    })),
  }
}
