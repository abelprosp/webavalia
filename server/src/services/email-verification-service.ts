import crypto from 'node:crypto'
import { pool } from '../db/pool.js'
import { config } from '../config.js'
import { isSmtpConfigured, sendEmail } from './email-service.js'

const TOKEN_BYTES = 32
const TOKEN_TTL_HOURS = 24

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function buildVerificationUrl(token: string) {
  return `${config.appUrl}/verify-email?token=${encodeURIComponent(token)}`
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildVerificationEmail(name: string, verifyUrl: string) {
  const subject = 'Confirme seu e-mail — Avalia Imob'
  const safeName = escapeHtml(name)

  const text = [
    `Olá, ${name}!`,
    '',
    'Obrigado por se cadastrar na Avalia Imob.',
    'Para ativar sua conta, confirme seu e-mail acessando o link abaixo:',
    '',
    verifyUrl,
    '',
    `Este link expira em ${TOKEN_TTL_HOURS} horas.`,
    'Se você não criou esta conta, ignore este e-mail.',
  ].join('\n')

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <h2 style="margin-bottom: 8px;">Confirme seu e-mail</h2>
      <p>Olá, <strong>${safeName}</strong>!</p>
      <p>Obrigado por se cadastrar na <strong>Avalia Imob</strong>.</p>
      <p>Clique no botão abaixo para ativar sua conta:</p>
      <p style="margin: 24px 0;">
        <a href="${verifyUrl}"
           style="background:#16a34a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">
          Confirmar e-mail
        </a>
      </p>
      <p style="font-size: 14px; color: #555;">
        Ou copie e cole este link no navegador:<br />
        <a href="${verifyUrl}">${verifyUrl}</a>
      </p>
      <p style="font-size: 13px; color: #777;">
        Este link expira em ${TOKEN_TTL_HOURS} horas.
        Se você não criou esta conta, ignore este e-mail.
      </p>
    </div>
  `

  return { subject, text, html }
}

export async function createAndSendVerificationEmail(input: {
  userId: string
  email: string
  name: string
}) {
  const token = crypto.randomBytes(TOKEN_BYTES).toString('hex')
  const tokenHash = hashToken(token)
  const verifyUrl = buildVerificationUrl(token)

  await pool.query(
    `DELETE FROM email_verification_tokens WHERE user_id = $1`,
    [input.userId]
  )

  await pool.query(
    `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '${TOKEN_TTL_HOURS} hours')`,
    [input.userId, tokenHash]
  )

  if (!isSmtpConfigured()) {
    if (config.isProduction) {
      throw new Error('SMTP não configurado.')
    }

    console.log(`[dev] Link de verificação para ${input.email}: ${verifyUrl}`)
    return { devLink: verifyUrl }
  }

  const emailContent = buildVerificationEmail(input.name, verifyUrl)
  await sendEmail({
    to: input.email,
    ...emailContent,
  })

  return {}
}

export async function verifyEmailToken(rawToken: string) {
  const tokenHash = hashToken(rawToken)

  const result = await pool.query<{
    user_id: string
    expires_at: Date | string
    email_verified: boolean
  }>(
    `SELECT t.user_id, t.expires_at, u.email_verified
     FROM email_verification_tokens t
     JOIN users u ON u.id = t.user_id
     WHERE t.token_hash = $1`,
    [tokenHash]
  )

  const row = result.rows[0]
  if (!row) {
    return { ok: false as const, reason: 'invalid' as const }
  }

  if (row.email_verified) {
    await pool.query(
      `DELETE FROM email_verification_tokens WHERE user_id = $1`,
      [row.user_id]
    )
    return { ok: true as const, alreadyVerified: true, userId: row.user_id }
  }

  const expiresAt =
    row.expires_at instanceof Date ? row.expires_at : new Date(row.expires_at)

  if (expiresAt.getTime() < Date.now()) {
    return { ok: false as const, reason: 'expired' as const }
  }

  await pool.query(
    `UPDATE users
     SET email_verified = true, updated_at = NOW()
     WHERE id = $1`,
    [row.user_id]
  )

  await pool.query(
    `DELETE FROM email_verification_tokens WHERE user_id = $1`,
    [row.user_id]
  )

  return { ok: true as const, userId: row.user_id }
}

export async function resendVerificationForEmail(emailNormalized: string) {
  const result = await pool.query<{ id: string; name: string; email: string }>(
    `SELECT id, name, email
     FROM users
     WHERE email = $1 AND email_verified = false AND status = 'active'`,
    [emailNormalized]
  )

  const user = result.rows[0]
  if (!user) return false

  await createAndSendVerificationEmail({
    userId: user.id,
    email: user.email,
    name: user.name,
  })

  return true
}

export const EMAIL_VERIFICATION_SENT =
  'Se o cadastro for elegível, enviamos um link de confirmação para o seu e-mail.'

export const EMAIL_NOT_VERIFIED =
  'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada ou solicite um novo link.'
