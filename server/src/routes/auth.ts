import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { authRateLimiter } from '../middleware/rate-limit.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { hashPassword, verifyPassword } from '../utils/password.js'
import { passwordSchema } from '../utils/password-policy.js'
import { signToken } from '../utils/jwt.js'
import { getSetting } from '../services/settings-service.js'
import {
  mapUserResponse,
  USER_SELECT_FIELDS,
  type UserRow,
} from '../services/user-service.js'

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

router.use(authRateLimiter)

router.post('/register', async (req, res) => {
  const registrationEnabled = await getSetting<boolean>(
    'registration_enabled',
    true
  )

  if (!registrationEnabled) {
    return res.status(403).json({
      message: 'Cadastros temporariamente desabilitados.',
    })
  }

  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
    })
  }

  const { name, email, password } = parsed.data
  const normalizedEmail = email.toLowerCase()
  const trialTotal = await getSetting<number>('trial_evaluations_total', 3)
  const defaultLeadCredits = await getSetting<number>('default_lead_credits', 0)

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [
    normalizedEmail,
  ])
  if (existing.rowCount && existing.rowCount > 0) {
    return res.status(409).json({ message: 'E-mail já cadastrado.' })
  }

  const passwordHash = await hashPassword(password)
  const result = await pool.query<UserRow>(
    `INSERT INTO users (name, email, password_hash, role, trial_evaluations_remaining, lead_credits)
     VALUES ($1, $2, $3, 'corretor', $4, $5)
     RETURNING ${USER_SELECT_FIELDS}`,
    [name, normalizedEmail, passwordHash, trialTotal, defaultLeadCredits]
  )

  const user = result.rows[0]
  const token = signToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  })

  return res.status(201).json({
    user: await mapUserResponse(user),
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

  const result = await pool.query<UserRow & { password_hash: string }>(
    `SELECT ${USER_SELECT_FIELDS}, password_hash
     FROM users WHERE email = $1`,
    [normalizedEmail]
  )

  if (!result.rowCount) {
    return res.status(401).json({ message: 'E-mail ou senha incorretos.' })
  }

  const user = result.rows[0]

  if (user.status === 'suspended') {
    return res.status(403).json({
      message: 'Conta suspensa. Entre em contato com o suporte.',
    })
  }

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
    user: await mapUserResponse(user),
    token,
  })
})

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  const result = await pool.query<UserRow>(
    `SELECT ${USER_SELECT_FIELDS} FROM users WHERE id = $1`,
    [req.user!.id]
  )

  if (!result.rowCount) {
    return res.status(404).json({ message: 'Usuário não encontrado.' })
  }

  if (result.rows[0].status === 'suspended') {
    return res.status(403).json({
      message: 'Conta suspensa. Entre em contato com o suporte.',
    })
  }

  return res.json({ user: await mapUserResponse(result.rows[0]) })
})

export default router
