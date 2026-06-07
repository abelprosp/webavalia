import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/roles.js'
import {
  adjustLeadCredits,
  setTrialEvaluations,
} from '../services/credits-service.js'
import {
  getPlatformSettings,
  updatePlatformSettings,
} from '../services/settings-service.js'
import {
  mapUserResponse,
  USER_SELECT_FIELDS,
  type UserRow,
} from '../services/user-service.js'

const router = Router()

router.use(requireAuth, requireAdmin)

function getParamId(value: string | string[]) {
  return Array.isArray(value) ? value[0] : value
}

function mapPlan(row: {
  id: string
  name: string
  description: string | null
  price_cents: number
  lead_credits: number
  trial_evaluations: number
  is_active: boolean
  sort_order: number
}) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    leadCredits: row.lead_credits,
    trialEvaluations: row.trial_evaluations,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  }
}

router.get('/stats', async (_req, res) => {
  const result = await pool.query<{
    total_users: string
    total_corretores: string
    total_admins: string
    total_evaluations_used: string
    total_lead_credits: string
  }>(`
    SELECT
      COUNT(*)::text AS total_users,
      COUNT(*) FILTER (WHERE role = 'corretor')::text AS total_corretores,
      COUNT(*) FILTER (WHERE role = 'admin')::text AS total_admins,
      COALESCE(SUM(evaluations_used), 0)::text AS total_evaluations_used,
      COALESCE(SUM(lead_credits), 0)::text AS total_lead_credits
    FROM users
  `)

  const plans = await pool.query(
    'SELECT COUNT(*)::int AS count FROM plans WHERE is_active = true'
  )

  return res.json({
    stats: {
      totalUsers: Number(result.rows[0].total_users),
      totalCorretores: Number(result.rows[0].total_corretores),
      totalAdmins: Number(result.rows[0].total_admins),
      totalEvaluationsUsed: Number(result.rows[0].total_evaluations_used),
      totalLeadCredits: Number(result.rows[0].total_lead_credits),
      activePlans: plans.rows[0]?.count ?? 0,
    },
  })
})

router.get('/users', async (req, res) => {
  const search = String(req.query.search ?? '').trim()
  const role = String(req.query.role ?? '').trim()

  const conditions: string[] = []
  const params: unknown[] = []

  if (search) {
    params.push(`%${search}%`)
    conditions.push(
      `(name ILIKE $${params.length} OR email ILIKE $${params.length})`
    )
  }

  if (role && role !== 'all') {
    params.push(role)
    conditions.push(`role = $${params.length}`)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const result = await pool.query<UserRow>(
    `SELECT ${USER_SELECT_FIELDS}
     FROM users
     ${where}
     ORDER BY created_at DESC`,
    params
  )

  const users = await Promise.all(result.rows.map(mapUserResponse))
  return res.json({ users })
})

const updateUserSchema = z.object({
  name: z.string().trim().min(2).optional(),
  role: z.enum(['admin', 'corretor']).optional(),
  status: z.enum(['active', 'suspended']).optional(),
})

router.patch('/users/:id', async (req: AuthRequest, res) => {
  const parsed = updateUserSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
    })
  }

  if (getParamId(req.params.id) === req.user!.id && parsed.data.role === 'corretor') {
    return res.status(400).json({
      message: 'Você não pode remover seu próprio acesso de administrador.',
    })
  }

  const fields: string[] = []
  const values: unknown[] = []
  let index = 1

  for (const [key, value] of Object.entries(parsed.data)) {
    if (value === undefined) continue
    fields.push(`${key} = $${index++}`)
    values.push(value)
  }

  if (!fields.length) {
    return res.status(400).json({ message: 'Nenhum campo para atualizar.' })
  }

  fields.push(`updated_at = NOW()`)
  values.push(getParamId(req.params.id))

  const result = await pool.query<UserRow>(
    `UPDATE users SET ${fields.join(', ')}
     WHERE id = $${index}
     RETURNING ${USER_SELECT_FIELDS}`,
    values
  )

  if (!result.rowCount) {
    return res.status(404).json({ message: 'Usuário não encontrado.' })
  }

  return res.json({ user: await mapUserResponse(result.rows[0]) })
})

router.post('/users/:id/credits', async (req: AuthRequest, res) => {
  const parsed = z
    .object({
      amount: z.number().int(),
      description: z.string().optional(),
    })
    .safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
    })
  }

  try {
    const leadCredits = await adjustLeadCredits({
      userId: getParamId(req.params.id),
      amount: parsed.data.amount,
      type: 'admin_adjustment',
      description: parsed.data.description,
      createdBy: req.user!.id,
    })

    return res.json({ leadCredits })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erro ao ajustar créditos.'
    return res.status(400).json({ message })
  }
})

router.post('/users/:id/trial-evaluations', async (req: AuthRequest, res) => {
  const parsed = z
    .object({
      remaining: z.number().int().min(0),
    })
    .safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
    })
  }

  try {
    const trialEvaluationsRemaining = await setTrialEvaluations(
      getParamId(req.params.id),
      parsed.data.remaining,
      req.user!.id
    )

    return res.json({ trialEvaluationsRemaining })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erro ao ajustar avaliações.'
    return res.status(400).json({ message })
  }
})

router.get('/plans', async (_req, res) => {
  const result = await pool.query(
    'SELECT * FROM plans ORDER BY sort_order ASC, created_at ASC'
  )
  return res.json({ plans: result.rows.map(mapPlan) })
})

const planSchema = z.object({
  name: z.string().trim().min(2),
  description: z.string().optional(),
  priceCents: z.number().int().min(0),
  leadCredits: z.number().int().min(0),
  trialEvaluations: z.number().int().min(0),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
})

router.post('/plans', async (req, res) => {
  const parsed = planSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
    })
  }

  const p = parsed.data
  const result = await pool.query(
    `INSERT INTO plans (name, description, price_cents, lead_credits, trial_evaluations, is_active, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      p.name,
      p.description ?? null,
      p.priceCents,
      p.leadCredits,
      p.trialEvaluations,
      p.isActive,
      p.sortOrder,
    ]
  )

  return res.status(201).json({ plan: mapPlan(result.rows[0]) })
})

router.patch('/plans/:id', async (req, res) => {
  const parsed = planSchema.partial().safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
    })
  }

  const fieldMap: Record<string, string> = {
    name: 'name',
    description: 'description',
    priceCents: 'price_cents',
    leadCredits: 'lead_credits',
    trialEvaluations: 'trial_evaluations',
    isActive: 'is_active',
    sortOrder: 'sort_order',
  }

  const fields: string[] = []
  const values: unknown[] = []
  let index = 1

  for (const [key, value] of Object.entries(parsed.data)) {
    if (value === undefined) continue
    fields.push(`${fieldMap[key]} = $${index++}`)
    values.push(value)
  }

  if (!fields.length) {
    return res.status(400).json({ message: 'Nenhum campo para atualizar.' })
  }

  fields.push('updated_at = NOW()')
  values.push(getParamId(req.params.id))

  const result = await pool.query(
    `UPDATE plans SET ${fields.join(', ')} WHERE id = $${index} RETURNING *`,
    values
  )

  if (!result.rowCount) {
    return res.status(404).json({ message: 'Plano não encontrado.' })
  }

  return res.json({ plan: mapPlan(result.rows[0]) })
})

router.delete('/plans/:id', async (req, res) => {
  const result = await pool.query(
    'DELETE FROM plans WHERE id = $1 RETURNING id',
    [getParamId(req.params.id)]
  )

  if (!result.rowCount) {
    return res.status(404).json({ message: 'Plano não encontrado.' })
  }

  return res.status(204).send()
})

router.get('/settings', async (_req, res) => {
  const settings = await getPlatformSettings()
  return res.json({ settings })
})

router.patch('/settings', async (req, res) => {
  const parsed = z
    .object({
      trialEvaluationsTotal: z.number().int().min(0).optional(),
      defaultLeadCredits: z.number().int().min(0).optional(),
      registrationEnabled: z.boolean().optional(),
    })
    .safeParse(req.body)

  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
    })
  }

  const settings = await updatePlatformSettings(parsed.data)
  return res.json({ settings })
})

router.get('/transactions', async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 100)
  const result = await pool.query(
    `SELECT t.id, t.amount, t.type, t.description, t.created_at,
            u.name AS user_name, u.email AS user_email,
            a.name AS admin_name
     FROM credit_transactions t
     JOIN users u ON u.id = t.user_id
     LEFT JOIN users a ON a.id = t.created_by
     ORDER BY t.created_at DESC
     LIMIT $1`,
    [limit]
  )

  return res.json({
    transactions: result.rows.map((row) => ({
      id: row.id,
      amount: row.amount,
      type: row.type,
      description: row.description,
      createdAt: row.created_at,
      userName: row.user_name,
      userEmail: row.user_email,
      adminName: row.admin_name,
    })),
  })
})

export default router
