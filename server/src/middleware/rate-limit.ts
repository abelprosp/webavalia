import type { Request, Response, NextFunction } from 'express'

type RateLimitEntry = {
  count: number
  resetAt: number
}

const buckets = new Map<string, RateLimitEntry>()

function getClientKey(req: Request) {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() ?? req.ip ?? 'unknown'
  }
  return req.ip ?? 'unknown'
}

export function createRateLimiter(options: {
  windowMs: number
  max: number
  message?: string
}) {
  const { windowMs, max, message = 'Muitas tentativas. Tente novamente em breve.' } =
    options

  return (req: Request, res: Response, next: NextFunction) => {
    const key = getClientKey(req)
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

export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Muitas tentativas de login ou cadastro. Aguarde alguns minutos.',
})
