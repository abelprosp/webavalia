import type { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../utils/jwt.js'

export type AuthRequest = Request & {
  user?: {
    id: string
    email: string
    role: string
  }
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token não informado.' })
  }

  try {
    const token = header.slice(7)
    const payload = verifyToken(token)
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    }
    next()
  } catch {
    return res.status(401).json({ message: 'Token inválido ou expirado.' })
  }
}
