import crypto from 'node:crypto'
import { pool } from '../db/pool.js'
import { config } from '../config.js'
import { isSmtpConfigured, sendEmail } from './email-service.js'
import { hashPassword } from '../utils/password.js'

const TOKEN_BYTES = 32
const TOKEN_TTL_HOURS = 2

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildResetUrl(token: string) {
  return `${config.appUrl}/reset-password?token=${encodeURIComponent(token)}`
}

export async function requestPasswordReset(email: string) {
  const user = await pool.query<{ id: string; name: string; email: string }>(
    `SELECT id, name, email FROM users WHERE email = $1 LIMIT 1`,
    [email]
  )

  if (!user.rowCount) {
    return { sent: false as const }
  }

  const row = user.rows[0]!
  const token = crypto.randomBytes(TOKEN_BYTES).toString('hex')
  const tokenHash = hashToken(token)
  const resetUrl = buildResetUrl(token)

  await pool.query(`DELETE FROM password_reset_tokens WHERE user_id = $1`, [
    row.id,
  ])
  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '${TOKEN_TTL_HOURS} hours')`,
    [row.id, tokenHash]
  )

  if (!isSmtpConfigured()) {
    if (config.isProduction) {
      throw new Error('SMTP não configurado.')
    }
    console.info(`[dev] Password reset link for ${row.email}: ${resetUrl}`)
    return { sent: true as const }
  }

  const safeName = escapeHtml(row.name)
  await sendEmail({
    to: row.email,
    subject: 'Redefinir senha — Avalia Imob',
    text: [
      `Olá, ${row.name}!`,
      '',
      'Recebemos um pedido para redefinir sua senha na Avalia Imob.',
      'Use o link abaixo (válido por 2 horas):',
      '',
      resetUrl,
      '',
      'Se você não solicitou isso, ignore este e-mail.',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
        <h2>Redefinir senha</h2>
        <p>Olá, <strong>${safeName}</strong>!</p>
        <p>Recebemos um pedido para redefinir sua senha na Avalia Imob.</p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}"
             style="background:#16a34a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">
            Redefinir senha
          </a>
        </p>
        <p style="font-size: 13px; color: #777;">
          O link expira em ${TOKEN_TTL_HOURS} horas. Se você não solicitou, ignore este e-mail.
        </p>
      </div>
    `,
  })

  return { sent: true as const }
}

export async function resetPasswordWithToken(token: string, newPassword: string) {
  const tokenHash = hashToken(token)
  const result = await pool.query<{ user_id: string }>(
    `SELECT user_id FROM password_reset_tokens
     WHERE token_hash = $1 AND expires_at > NOW()
     LIMIT 1`,
    [tokenHash]
  )

  if (!result.rowCount) {
    throw new Error('Link inválido ou expirado.')
  }

  const userId = result.rows[0]!.user_id
  const passwordHash = await hashPassword(newPassword)

  await pool.query(
    `UPDATE users
     SET password_hash = $2,
         session_version = session_version + 1,
         updated_at = NOW()
     WHERE id = $1`,
    [userId, passwordHash]
  )

  await pool.query(`DELETE FROM password_reset_tokens WHERE user_id = $1`, [
    userId,
  ])

  return { ok: true as const }
}
