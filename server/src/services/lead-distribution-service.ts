import { pool } from '../db/pool.js'

function normalizeRegion(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export async function pickAssigneeForLead(input: {
  leadId: string
  location?: string | null
  propertyType?: string | null
  fallbackUserId: string
}) {
  const locationNorm = input.location ? normalizeRegion(input.location) : ''

  const brokers = await pool.query<{
    id: string
    service_regions: string[] | null
    specialties: string[] | null
  }>(
    `SELECT id, service_regions, specialties
     FROM users
     WHERE account_type = 'pj' AND status = 'active'
     ORDER BY created_at ASC`
  )

  if (!brokers.rowCount) return input.fallbackUserId

  let candidates = brokers.rows

  if (locationNorm) {
    const regional = candidates.filter((broker) =>
      (broker.service_regions ?? []).some((region) =>
        locationNorm.includes(normalizeRegion(region))
      )
    )
    if (regional.length > 0) candidates = regional
  }

  if (input.propertyType) {
    const typeNorm = normalizeRegion(input.propertyType)
    const specialized = candidates.filter((broker) =>
      (broker.specialties ?? []).some((spec) =>
        typeNorm.includes(normalizeRegion(spec))
      )
    )
    if (specialized.length > 0) candidates = specialized
  }

  const lastAssignment = await pool.query<{ user_id: string }>(
    `SELECT user_id FROM lead_assignments
     ORDER BY assigned_at DESC
     LIMIT 1`
  )

  const lastUserId = lastAssignment.rows[0]?.user_id
  const startIndex =
    lastUserId != null
      ? (candidates.findIndex((c) => c.id === lastUserId) + 1) % candidates.length
      : 0

  const selected = candidates[startIndex] ?? candidates[0]
  if (!selected) return input.fallbackUserId

  await pool.query(
    `INSERT INTO lead_assignments (lead_id, user_id, method)
     VALUES ($1, $2, 'auto')`,
    [input.leadId, selected.id]
  )

  await pool.query(`UPDATE leads SET assignee_id = $1 WHERE id = $2`, [
    selected.id,
    input.leadId,
  ])

  return selected.id
}
