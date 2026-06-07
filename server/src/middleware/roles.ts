import type { Response, NextFunction } from 'express'
import type { AuthRequest } from './auth.js'

export const ROLES = {
  ADMIN: 'admin',
  CORRETOR: 'corretor',
} as const

export type UserRole = (typeof ROLES)[keyof typeof ROLES]

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user?.role || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Acesso negado.' })
    }
    return next()
  }
}

export const requireAdmin = requireRole(ROLES.ADMIN)
