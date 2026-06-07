import type { Response } from 'express'
import { config } from '../config.js'

export const AUTH_COOKIE_NAME = 'avalia_session'

const MAX_AGE_SECONDS = 24 * 60 * 60

export function setAuthCookie(res: Response, token: string) {
  const parts = [
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${MAX_AGE_SECONDS}`,
    'SameSite=Lax',
  ]

  if (config.isProduction) {
    parts.push('Secure')
  }

  res.setHeader('Set-Cookie', parts.join('; '))
}

export function clearAuthCookie(res: Response) {
  const parts = [
    `${AUTH_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    'SameSite=Lax',
  ]

  if (config.isProduction) {
    parts.push('Secure')
  }

  res.setHeader('Set-Cookie', parts.join('; '))
}
