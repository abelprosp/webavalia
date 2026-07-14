import crypto from 'node:crypto'
import { pool } from '../db/pool.js'
import { config } from '../config.js'
import { getSmsProvider, isTwilioConfigured } from './sms-provider.js'

const CODE_TTL_MINUTES = 10
const MAX_VERIFY_ATTEMPTS = 5

function hashCode(code: string) {
  return crypto.createHash('sha256').update(code).digest('hex')
}

function generateCode() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')
}

function buildSmsBody(code: string) {
  return `Seu código de verificação Avalia Imob é ${code}. Válido por ${CODE_TTL_MINUTES} minutos.`
}

export async function createAndSendPhoneCode(input: {
  userId: string
  phoneDigits: string
}) {
  const code = generateCode()
  const codeHash = hashCode(code)

  await pool.query(`DELETE FROM phone_verification_codes WHERE user_id = $1`, [
    input.userId,
  ])

  await pool.query(
    `INSERT INTO phone_verification_codes (user_id, phone, code_hash, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '${CODE_TTL_MINUTES} minutes')`,
    [input.userId, input.phoneDigits, codeHash]
  )

  if (!isTwilioConfigured()) {
    if (config.isProduction) {
      throw new Error('SMS não configurado.')
    }

    console.log(
      `[dev] Código SMS para ${input.phoneDigits} (usuário ${input.userId}): ${code}`
    )
    return { devCode: code }
  }

  const sms = getSmsProvider()
  await sms.sendSms({
    toDigits: input.phoneDigits,
    body: buildSmsBody(code),
  })

  return {}
}

export async function verifyPhoneCode(input: {
  emailNormalized: string
  code: string
}) {
  const userResult = await pool.query<{
    id: string
    phone_verified: boolean
    phone: string | null
  }>(
    `SELECT id, phone_verified, phone
     FROM users
     WHERE email = $1 AND status = 'active'`,
    [input.emailNormalized]
  )

  const user = userResult.rows[0]
  if (!user) {
    return { ok: false as const, reason: 'invalid' as const }
  }

  if (user.phone_verified) {
    return { ok: true as const, alreadyVerified: true, userId: user.id }
  }

  const codeResult = await pool.query<{
    code_hash: string
    expires_at: Date | string
    attempts: number
    phone: string
  }>(
    `SELECT code_hash, expires_at, attempts, phone
     FROM phone_verification_codes
     WHERE user_id = $1`,
    [user.id]
  )

  const row = codeResult.rows[0]
  if (!row) {
    return { ok: false as const, reason: 'invalid' as const }
  }

  if (row.attempts >= MAX_VERIFY_ATTEMPTS) {
    return { ok: false as const, reason: 'too_many_attempts' as const }
  }

  const expiresAt =
    row.expires_at instanceof Date ? row.expires_at : new Date(row.expires_at)

  if (expiresAt.getTime() < Date.now()) {
    return { ok: false as const, reason: 'expired' as const }
  }

  const codeHash = hashCode(input.code.trim())
  if (codeHash !== row.code_hash) {
    await pool.query(
      `UPDATE phone_verification_codes
       SET attempts = attempts + 1
       WHERE user_id = $1`,
      [user.id]
    )
    return { ok: false as const, reason: 'invalid' as const }
  }

  await pool.query(
    `UPDATE users
     SET phone_verified = true, phone = $2, updated_at = NOW()
     WHERE id = $1`,
    [user.id, row.phone]
  )

  await pool.query(`DELETE FROM phone_verification_codes WHERE user_id = $1`, [
    user.id,
  ])

  return { ok: true as const, userId: user.id }
}

export async function resendPhoneCodeForEmail(emailNormalized: string) {
  const result = await pool.query<{
    id: string
    phone: string | null
    phone_verified: boolean
  }>(
    `SELECT id, phone, phone_verified
     FROM users
     WHERE email = $1 AND status = 'active' AND phone_verified = false`,
    [emailNormalized]
  )

  const user = result.rows[0]
  if (!user?.phone) return false

  await createAndSendPhoneCode({
    userId: user.id,
    phoneDigits: user.phone,
  })

  return true
}

export async function isPhoneTakenByAnotherUser(
  phoneDigits: string,
  excludeUserId?: string
) {
  const result = await pool.query<{ id: string }>(
    `SELECT id FROM users
     WHERE phone = $1 AND phone_verified = true
       AND ($2::uuid IS NULL OR id <> $2)
     LIMIT 1`,
    [phoneDigits, excludeUserId ?? null]
  )

  return Boolean(result.rowCount)
}

export const PHONE_VERIFICATION_SENT =
  'Enviamos um código de verificação por SMS para o seu telefone.'

export const PHONE_NOT_VERIFIED =
  'Confirme seu telefone antes de entrar. Verifique o SMS ou solicite um novo código.'
