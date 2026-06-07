import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { authRateLimiter } from '../middleware/rate-limit.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { hashPassword, verifyPassword } from '../utils/password.js'
import {
  passwordSchema,
  TRIAL_EVALUATIONS_TOTAL,
} from '../utils/password-policy.js'
import { signToken } from '../utils/jwt.js'

const router = Router()

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Nome deve ter ao menos 2 caracteres.'),
  email: z.email('E-mail inválido.'),
  password: passwordSchema,
})

const loginSchema = z.object({
  email: z.email('E-mail inválido.'),
  password: z.string().min(1, 'Informe a senha.'),
})

function toUserResponse(row: {
  id: string
  name: string
  email: string
  role: string
  trial_evaluations_remaining: number
}) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    trialEvaluationsRemaining: row.trial_evaluations_remaining,
    trialEvaluationsTotal: TRIAL_EVALUATIONS_TOTAL,
  }
}

router.use(authRateLimiter)

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
    })
  }

  const { name, email, password } = parsed.data
  const normalizedEmail = email.toLowerCase()

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [
    normalizedEmail,
  ])
  if (existing.rowCount && existing.rowCount > 0) {
    return res.status(409).json({ message: 'E-mail já cadastrado.' })
  }

  const passwordHash = await hashPassword(password)
  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash, trial_evaluations_remaining)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, role, trial_evaluations_remaining`,
    [name, normalizedEmail, passwordHash, TRIAL_EVALUATIONS_TOTAL]
  )

  const user = result.rows[0]
  const token = signToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  })

  return res.status(201).json({
    user: toUserResponse(user),
    token,
  })
})

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
    })
  }

  const { email, password } = parsed.data
  const normalizedEmail = email.toLowerCase()

  const result = await pool.query(
    `SELECT id, name, email, role, password_hash, trial_evaluations_remaining
     FROM users WHERE email = $1`,
    [normalizedEmail]
  )

  if (!result.rowCount) {
    return res.status(401).json({ message: 'E-mail ou senha incorretos.' })
  }

  const user = result.rows[0]
  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) {
    return res.status(401).json({ message: 'E-mail ou senha incorretos.' })
  }

  const token = signToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  })

  return res.json({
    user: toUserResponse(user),
    token,
  })
})

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  const result = await pool.query(
    `SELECT id, name, email, role, trial_evaluations_remaining
     FROM users WHERE id = $1`,
    [req.user!.id]
  )

  if (!result.rowCount) {
    return res.status(404).json({ message: 'Usuário não encontrado.' })
  }

  return res.json({ user: toUserResponse(result.rows[0]) })
})

export default router
