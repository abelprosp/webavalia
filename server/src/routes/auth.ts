import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { hashPassword, verifyPassword } from '../utils/password.js'
import { signToken } from '../utils/jwt.js'

const router = Router()

const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres.'),
  email: z.email('E-mail inválido.'),
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres.'),
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
}) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
  }
}

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.issues[0]?.message ?? 'Dados inválidos.',
    })
  }

  const { name, email, password } = parsed.data

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [
    email,
  ])
  if (existing.rowCount && existing.rowCount > 0) {
    return res.status(409).json({ message: 'E-mail já cadastrado.' })
  }

  const passwordHash = await hashPassword(password)
  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, name, email, role`,
    [name, email.toLowerCase(), passwordHash]
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

  const result = await pool.query(
    'SELECT id, name, email, role, password_hash FROM users WHERE email = $1',
    [email.toLowerCase()]
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
    'SELECT id, name, email, role FROM users WHERE id = $1',
    [req.user!.id]
  )

  if (!result.rowCount) {
    return res.status(404).json({ message: 'Usuário não encontrado.' })
  }

  return res.json({ user: toUserResponse(result.rows[0]) })
})

export default router
