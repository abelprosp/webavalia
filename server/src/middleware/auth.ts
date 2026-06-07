import type { Request, Response, NextFunction } from 'express'
import { pool } from '../db/pool.js'
import { AUTH_COOKIE_NAME } from '../utils/auth-cookie.js'
import { verifyToken } from '../utils/jwt.js'

export type AuthRequest = Request & {
  user?: {
    id: string
    email: string
    role: string
  }
}

type DbUser = {
  id: string
  email: string
  role: string
  status: string
  session_version: number
  email_verified: boolean
}

function extractToken(req: Request) {
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) {
    return header.slice(7)
  }

  const cookies = req.headers.cookie
  if (!cookies) return null

  const match = cookies.match(
    new RegExp(`(?:^|; )${AUTH_COOKIE_NAME}=([^;]*)`)
  )
  return match ? decodeURIComponent(match[1]) : null
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const token = extractToken(req)
  if (!token) {
    return res.status(401).json({ message: 'Sessão não informada.' })
  }

  try {
    const payload = verifyToken(token)
    const result = await pool.query<DbUser>(
      `SELECT id, email, role, status, session_version, email_verified
       FROM users WHERE id = $1`,
      [payload.sub]
    )

    const user = result.rows[0]
    if (!user) {
      return res.status(401).json({ message: 'Sessão inválida.' })
    }

    if (user.status === 'suspended') {
      return res.status(403).json({
        message: 'Conta suspensa. Entre em contato com o suporte.',
      })
    }

    if (!user.email_verified) {
      return res.status(403).json({
        message:
          'Confirme seu e-mail antes de continuar. Verifique sua caixa de entrada.',
        code: 'EMAIL_NOT_VERIFIED',
      })
    }

    const tokenSessionVersion = payload.sessionVersion ?? 0
    if (user.session_version !== tokenSessionVersion) {
      return res.status(401).json({ message: 'Sessão expirada. Faça login novamente.' })
    }

    if (user.role !== payload.role) {
      return res.status(401).json({ message: 'Sessão expirada. Faça login novamente.' })
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    }
    return next()
  } catch {
    return res.status(401).json({ message: 'Sessão inválida ou expirada.' })
  }
}
