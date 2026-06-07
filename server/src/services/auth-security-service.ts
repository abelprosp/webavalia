import { pool } from '../db/pool.js'
import { AUTH_ACCOUNT_LOCKED } from '../constants/auth-messages.js'

const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000
const LOCKOUT_DURATION_MS = 30 * 60 * 1000

export class AuthLockoutError extends Error {
  constructor(message = AUTH_ACCOUNT_LOCKED) {
    super(message)
    this.name = 'AuthLockoutError'
  }
}

export class HoneypotError extends Error {
  constructor() {
    super('Requisição rejeitada.')
    this.name = 'HoneypotError'
  }
}

type LockoutRow = {
  failed_attempts: number
  locked_until: Date | string | null
  last_attempt_at: Date | string
}

function isLocked(row: LockoutRow | undefined) {
  if (!row?.locked_until) return false
  const lockedUntil =
    row.locked_until instanceof Date
      ? row.locked_until
      : new Date(row.locked_until)
  return lockedUntil.getTime() > Date.now()
}

export function assertHoneypotEmpty(value: unknown) {
  if (typeof value === 'string' && value.trim().length > 0) {
    throw new HoneypotError()
  }
}

export async function assertLoginAllowed(emailNormalized: string) {
  const result = await pool.query<LockoutRow>(
    `SELECT failed_attempts, locked_until, last_attempt_at
     FROM auth_login_lockouts
     WHERE email_normalized = $1`,
    [emailNormalized]
  )

  const row = result.rows[0]
  if (!row) return

  if (isLocked(row)) {
    throw new AuthLockoutError()
  }

  const lastAttempt =
    row.last_attempt_at instanceof Date
      ? row.last_attempt_at
      : new Date(row.last_attempt_at)

  if (Date.now() - lastAttempt.getTime() > LOCKOUT_WINDOW_MS) {
    await pool.query(
      `UPDATE auth_login_lockouts
       SET failed_attempts = 0, locked_until = NULL, last_attempt_at = NOW()
       WHERE email_normalized = $1`,
      [emailNormalized]
    )
  }
}

export async function recordFailedLogin(emailNormalized: string) {
  const result = await pool.query<LockoutRow>(
    `INSERT INTO auth_login_lockouts (email_normalized, failed_attempts, last_attempt_at)
     VALUES ($1, 1, NOW())
     ON CONFLICT (email_normalized) DO UPDATE
     SET failed_attempts = CASE
           WHEN auth_login_lockouts.last_attempt_at < NOW() - INTERVAL '15 minutes'
             THEN 1
           ELSE auth_login_lockouts.failed_attempts + 1
         END,
         last_attempt_at = NOW(),
         locked_until = CASE
           WHEN (
             CASE
               WHEN auth_login_lockouts.last_attempt_at < NOW() - INTERVAL '15 minutes'
                 THEN 1
               ELSE auth_login_lockouts.failed_attempts + 1
             END
           ) >= ${MAX_FAILED_ATTEMPTS}
             THEN NOW() + INTERVAL '30 minutes'
           ELSE auth_login_lockouts.locked_until
         END
     RETURNING failed_attempts, locked_until, last_attempt_at`,
    [emailNormalized]
  )

  return result.rows[0]
}

export async function recordSuccessfulLogin(emailNormalized: string) {
  await pool.query(
    `DELETE FROM auth_login_lockouts WHERE email_normalized = $1`,
    [emailNormalized]
  )
}

export async function logAuthAttempt(input: {
  emailNormalized: string
  ipAddress: string | null
  action: 'login' | 'register' | 'forgot_password'
  success: boolean
}) {
  await pool.query(
    `INSERT INTO auth_attempt_logs (email_normalized, ip_address, action, success)
     VALUES ($1, $2, $3, $4)`,
    [input.emailNormalized, input.ipAddress, input.action, input.success]
  )
}

export async function countRecentIpFailures(
  ipAddress: string,
  windowMinutes = 15
) {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM auth_attempt_logs
     WHERE ip_address = $1
       AND success = false
       AND created_at > NOW() - make_interval(mins => $2)`,
    [ipAddress, windowMinutes]
  )

  return Number(result.rows[0]?.count ?? 0)
}

export async function countRecentEmailFailures(
  emailNormalized: string,
  windowMinutes = 15
) {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM auth_attempt_logs
     WHERE email_normalized = $1
       AND success = false
       AND action = 'login'
       AND created_at > NOW() - make_interval(mins => $2)`,
    [emailNormalized, windowMinutes]
  )

  return Number(result.rows[0]?.count ?? 0)
}

export const AUTH_SECURITY = {
  maxFailedAttempts: MAX_FAILED_ATTEMPTS,
  lockoutWindowMs: LOCKOUT_WINDOW_MS,
  lockoutDurationMs: LOCKOUT_DURATION_MS,
}
