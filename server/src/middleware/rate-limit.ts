import type { Request, Response, NextFunction } from 'express'
import type { AuthRequest } from './auth.js'

type RateLimitEntry = {
  count: number
  resetAt: number
}

const buckets = new Map<string, RateLimitEntry>()

function getClientKey(req: Request) {
  return req.ip ?? 'unknown'
}

export function createRateLimiter(options: {
  windowMs: number
  max: number
  message?: string
  keyGenerator?: (req: Request) => string
}) {
  const {
    windowMs,
    max,
    message = 'Muitas tentativas. Tente novamente em breve.',
    keyGenerator = getClientKey,
  } = options

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req)
    const now = Date.now()
    const current = buckets.get(key)

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs })
      return next()
    }

    if (current.count >= max) {
      const retryAfterSeconds = Math.ceil((current.resetAt - now) / 1000)
      res.setHeader('Retry-After', String(retryAfterSeconds))
      return res.status(429).json({ message })
    }

    current.count += 1
    buckets.set(key, current)
    return next()
  }
}

export function createUserRateLimiter(options: {
  windowMs: number
  max: number
  message?: string
}) {
  return createRateLimiter({
    ...options,
    keyGenerator: (req) => {
      const authReq = req as AuthRequest
      return authReq.user?.id ?? getClientKey(req)
    },
  })
}

export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Muitas tentativas. Aguarde alguns minutos.',
})

export const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Muitas tentativas de login. Aguarde alguns minutos.',
})

export const loginIpRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 40,
  message: 'Muitas tentativas de login deste dispositivo. Tente mais tarde.',
})

export const registerRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Limite de cadastros atingido. Tente novamente mais tarde.',
})

export const resendVerificationRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Muitas solicitações de reenvio. Aguarde antes de tentar novamente.',
})

export const forgotPasswordRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Muitas solicitações. Aguarde antes de tentar novamente.',
})

export const phoneSendRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Muitas solicitações de SMS. Aguarde antes de tentar novamente.',
})

export const phoneVerifyRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Muitas tentativas de verificação. Aguarde alguns minutos.',
})

export const evaluationRateLimiter = createUserRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 15,
  message: 'Limite de avaliações por hora atingido. Tente novamente mais tarde.',
})

export const paymentRateLimiter = createUserRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Muitas tentativas de pagamento. Aguarde alguns minutos.',
})

export const webhookRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: 'Limite de requisições excedido.',
})
