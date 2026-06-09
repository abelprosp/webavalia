import type { Response, NextFunction } from 'express'
import type { AuthRequest } from './auth.js'
import { isBrokerAccountType } from '../constants/account-type.js'

export function requireBrokerAccount(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user?.accountType || !isBrokerAccountType(req.user.accountType)) {
    return res.status(403).json({
      message:
        'Recurso disponível apenas para contas de imobiliária ou corretor (pessoa jurídica).',
    })
  }
  return next()
}
