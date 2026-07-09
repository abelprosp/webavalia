import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import {
  forgotPasswordRateLimiter,
  loginIpRateLimiter,
  loginRateLimiter,
  registerRateLimiter,
  resendVerificationRateLimiter,
} from '../middleware/rate-limit.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import {
  hashPassword,
  verifyPasswordConstantTime,
} from '../utils/password.js'
import { passwordSchema } from '../utils/password-policy.js'
import { signToken } from '../utils/jwt.js'
import { setAuthCookie, clearAuthCookie } from '../utils/auth-cookie.js'
import { normalizeAuthTiming, normalizeEmail } from '../utils/auth-timing.js'
import { getSetting } from '../services/settings-service.js'
import {
  mapUserResponse,
  USER_SELECT_FIELDS,
  type UserRow,
} from '../services/user-service.js'
import {
  assertHoneypotEmpty,
  assertLoginAllowed,
  AuthLockoutError,
  countRecentEmailFailures,
  countRecentIpFailures,
  HoneypotError,
  logAuthAttempt,
  recordFailedLogin,
  recordSuccessfulLogin,
} from '../services/auth-security-service.js'
import {
  createAndSendVerificationEmail,
  EMAIL_NOT_VERIFIED,
  EMAIL_VERIFICATION_SENT,
  resendVerificationForEmail,
  verifyEmailToken,
} from '../services/email-verification-service.js'
import {
  AUTH_INVALID_CREDENTIALS,
  AUTH_RATE_LIMITED,
  FORGOT_PASSWORD_GENERIC,
  REGISTER_GENERIC_FAILURE,
} from '../constants/auth-messages.js'
import { ACCOUNT_TYPES } from '../constants/account-type.js'
import { validateDocumentForAccountType } from '../utils/document.js'

const router = Router()

const honeypotSchema = z.object({
  _honeypot: z.string().optional(),
})

const registerSchema = honeypotSchema
  .extend({
    accountType: z.enum(ACCOUNT_TYPES, {
      message: 'Selecione o tipo de conta.',
    }),
    name: z.string().trim().min(2, 'Nome deve ter ao menos 2 caracteres.'),
    email: z.email('E-mail inválido.'),
    password: passwordSchema,
    document: z.string().trim().min(11, 'Informe um CPF ou CNPJ válido.'),
    companyName: z.string().trim().optional(),
    tradeName: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    const documentCheck = validateDocumentForAccountType(
      data.accountType,
      data.document
    )
    if (!documentCheck.ok) {
      ctx.addIssue({
        code: 'custom',
        path: ['document'],
        message: documentCheck.message,
      })
    }

    if (data.accountType === 'pj' && !data.companyName?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['companyName'],
        message: 'Informe a razão social da imobiliária.',
      })
    }
  })

const loginSchema = honeypotSchema.extend({
  email: z.email('E-mail inválido.'),
  password: z.string().min(1, 'Informe a senha.').max(128, 'Senha inválida.'),
})

const forgotPasswordSchema = honeypotSchema.extend({
  email: z.email('E-mail inválido.'),
})

function getClientIp(req: AuthRequest) {
  return req.ip ?? null
}

function issueSession(
  user: Pick<UserRow, 'id' | 'email' | 'role' | 'session_version'>,
  res: Parameters<typeof setAuthCookie>[0]
) {
  const token = signToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    sessionVersion: user.session_version,
  })
  setAuthCookie(res, token)
  return token
}

async function rejectInvalidLogin(input: {
  emailNormalized: string
  ipAddress: string | null
  startedAt: number
  res: Parameters<typeof setAuthCookie>[0]
}) {
  await recordFailedLogin(input.emailNormalized)
  await logAuthAttempt({
    emailNormalized: input.emailNormalized,
    ipAddress: input.ipAddress,
    action: 'login',
    success: false,
  })
  await normalizeAuthTiming(input.startedAt)
  return input.res.status(401).json({ message: AUTH_INVALID_CREDENTIALS })
}

router.post(
  '/register',
  registerRateLimiter,
  async (req, res) => {
    const startedAt = Date.now()

    try {
      assertHoneypotEmpty(req.body?._honeypot)
    } catch {
      await normalizeAuthTiming(startedAt)
      return res.status(400).json({ message: REGISTER_GENERIC_FAILURE })
    }

    const registrationEnabled = await getSetting<boolean>(
      'registration_enabled',
      true
    )

    if (!registrationEnabled) {
      await normalizeAuthTiming(startedAt)
      return res.status(403).json({
        message: 'Cadastros temporariamente desabilitados.',
      })
    }

    const parsed = registerSchema.safeParse(req.body)
    if (!parsed.success) {
      await normalizeAuthTiming(startedAt)
      return res.status(400).json({
        message: parsed.error.issues[0]?.message ?? REGISTER_GENERIC_FAILURE,
      })
    }

    const { name, email, password, accountType, document, companyName, tradeName } =
      parsed.data
    const normalizedEmail = normalizeEmail(email)
    const ipAddress = getClientIp(req)
    const documentCheck = validateDocumentForAccountType(accountType, document)
    if (!documentCheck.ok) {
      await normalizeAuthTiming(startedAt)
      return res.status(400).json({ message: documentCheck.message })
    }

    const passwordHash = await hashPassword(password)

    const existing = await pool.query<{ id: string; email_verified: boolean; name: string }>(
      'SELECT id, email_verified, name FROM users WHERE email = $1',
      [normalizedEmail]
    )

    if (existing.rowCount && existing.rowCount > 0) {
      const existingUser = existing.rows[0]

      if (!existingUser.email_verified) {
        try {
          await createAndSendVerificationEmail({
            userId: existingUser.id,
            email: normalizedEmail,
            name: existingUser.name,
          })
        } catch (error) {
          console.error('Erro ao reenviar verificação no cadastro:', error)
        }

        await logAuthAttempt({
          emailNormalized: normalizedEmail,
          ipAddress,
          action: 'register',
          success: true,
        })
        await normalizeAuthTiming(startedAt)
        return res.status(201).json({
          needsEmailVerification: true,
          message: EMAIL_VERIFICATION_SENT,
          email: normalizedEmail,
        })
      }

      await logAuthAttempt({
        emailNormalized: normalizedEmail,
        ipAddress,
        action: 'register',
        success: false,
      })
      await normalizeAuthTiming(startedAt)
      return res.status(400).json({ message: REGISTER_GENERIC_FAILURE })
    }

    const trialTotal = await getSetting<number>('trial_evaluations_total', 3)
    const defaultLeadCredits = await getSetting<number>(
      'default_lead_credits',
      0
    )
    const initialCredits =
      trialTotal + (accountType === 'pf' ? 0 : defaultLeadCredits)

    const result = await pool.query<UserRow>(
      `INSERT INTO users (
         name, email, password_hash, role, account_type, document,
         company_name, trade_name, credits, email_verified
       )
       VALUES ($1, $2, $3, 'corretor', $4, $5, $6, $7, $8, false)
       RETURNING ${USER_SELECT_FIELDS}`,
      [
        name,
        normalizedEmail,
        passwordHash,
        accountType,
        documentCheck.digits,
        accountType === 'pj' ? companyName?.trim() ?? null : null,
        accountType === 'pj' ? tradeName?.trim() || null : null,
        initialCredits,
      ]
    )

    const user = result.rows[0]

    try {
      await createAndSendVerificationEmail({
        userId: user.id,
        email: user.email,
        name: user.name,
      })
    } catch (error) {
      console.error('Erro ao enviar e-mail de verificação:', error)
      await normalizeAuthTiming(startedAt)
      return res.status(503).json({
        message:
          'Conta criada, mas não foi possível enviar o e-mail de confirmação. Tente reenviar em alguns minutos.',
        needsEmailVerification: true,
        email: normalizedEmail,
      })
    }

    await logAuthAttempt({
      emailNormalized: normalizedEmail,
      ipAddress,
      action: 'register',
      success: true,
    })
    await normalizeAuthTiming(startedAt)

    return res.status(201).json({
      needsEmailVerification: true,
      message: EMAIL_VERIFICATION_SENT,
      email: normalizedEmail,
    })
  }
)

router.post(
  '/login',
  loginRateLimiter,
  loginIpRateLimiter,
  async (req, res) => {
    const startedAt = Date.now()
    const ipAddress = getClientIp(req)

    try {
      assertHoneypotEmpty(req.body?._honeypot)
    } catch {
      await normalizeAuthTiming(startedAt)
      return res.status(401).json({ message: AUTH_INVALID_CREDENTIALS })
    }

    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) {
      await normalizeAuthTiming(startedAt)
      return res.status(401).json({ message: AUTH_INVALID_CREDENTIALS })
    }

    const { email, password } = parsed.data
    const normalizedEmail = normalizeEmail(email)

    if (ipAddress) {
      const ipFailures = await countRecentIpFailures(ipAddress)
      if (ipFailures >= 50) {
        await normalizeAuthTiming(startedAt)
        return res.status(429).json({ message: AUTH_RATE_LIMITED })
      }
    }

    const emailFailures = await countRecentEmailFailures(normalizedEmail)
    if (emailFailures >= 15) {
      await normalizeAuthTiming(startedAt)
      return res.status(429).json({ message: AUTH_RATE_LIMITED })
    }

    try {
      await assertLoginAllowed(normalizedEmail)
    } catch (error) {
      if (error instanceof AuthLockoutError) {
        await normalizeAuthTiming(startedAt)
        return res.status(429).json({ message: error.message })
      }
      throw error
    }

    const result = await pool.query<
      UserRow & { password_hash: string; email_verified: boolean }
    >(
      `SELECT ${USER_SELECT_FIELDS}, password_hash
       FROM users WHERE email = $1`,
      [normalizedEmail]
    )

    const user = result.rows[0] ?? null
    const passwordValid = await verifyPasswordConstantTime(
      password,
      user?.password_hash
    )

    if (user && passwordValid && user.status === 'active' && !user.email_verified) {
      await normalizeAuthTiming(startedAt)
      return res.status(403).json({
        message: EMAIL_NOT_VERIFIED,
        code: 'EMAIL_NOT_VERIFIED',
      })
    }

    const loginAllowed =
      Boolean(user) &&
      passwordValid &&
      user!.status === 'active' &&
      user!.email_verified

    if (!loginAllowed) {
      return rejectInvalidLogin({
        emailNormalized: normalizedEmail,
        ipAddress,
        startedAt,
        res,
      })
    }

    await recordSuccessfulLogin(normalizedEmail)
    await logAuthAttempt({
      emailNormalized: normalizedEmail,
      ipAddress,
      action: 'login',
      success: true,
    })

    issueSession(user!, res)
    await normalizeAuthTiming(startedAt)

    return res.json({
      user: await mapUserResponse(user!),
    })
  }
)

router.get('/verify-email', async (req, res) => {
  const token = String(req.query.token ?? '').trim()

  if (!token) {
    return res.status(400).json({ message: 'Link de verificação inválido.' })
  }

  const result = await verifyEmailToken(token)

  if (!result.ok) {
    const message =
      result.reason === 'expired'
        ? 'Link expirado. Solicite um novo e-mail de confirmação.'
        : 'Link de verificação inválido ou já utilizado.'

    return res.status(400).json({ message, reason: result.reason })
  }

  return res.json({
    message: result.alreadyVerified
      ? 'E-mail já confirmado. Você já pode entrar.'
      : 'E-mail confirmado com sucesso! Agora você pode entrar.',
    verified: true,
  })
})

router.post(
  '/resend-verification',
  resendVerificationRateLimiter,
  async (req, res) => {
    const startedAt = Date.now()

    try {
      assertHoneypotEmpty(req.body?._honeypot)
    } catch {
      await normalizeAuthTiming(startedAt)
      return res.json({ message: EMAIL_VERIFICATION_SENT })
    }

    const parsed = forgotPasswordSchema.safeParse(req.body)
    if (!parsed.success) {
      await normalizeAuthTiming(startedAt)
      return res.json({ message: EMAIL_VERIFICATION_SENT })
    }

    const normalizedEmail = normalizeEmail(parsed.data.email)

    try {
      await resendVerificationForEmail(normalizedEmail)
    } catch (error) {
      console.error('Erro ao reenviar verificação:', error)
    }

    await normalizeAuthTiming(startedAt)
    return res.json({ message: EMAIL_VERIFICATION_SENT })
  }
)

router.post(
  '/forgot-password',
  forgotPasswordRateLimiter,
  async (req, res) => {
    const startedAt = Date.now()

    try {
      assertHoneypotEmpty(req.body?._honeypot)
    } catch {
      await normalizeAuthTiming(startedAt)
      return res.json({ message: FORGOT_PASSWORD_GENERIC })
    }

    const parsed = forgotPasswordSchema.safeParse(req.body)
    if (!parsed.success) {
      await normalizeAuthTiming(startedAt)
      return res.json({ message: FORGOT_PASSWORD_GENERIC })
    }

    const normalizedEmail = normalizeEmail(parsed.data.email)
    const ipAddress = getClientIp(req)

    await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail])

    await logAuthAttempt({
      emailNormalized: normalizedEmail,
      ipAddress,
      action: 'forgot_password',
      success: true,
    })

    await normalizeAuthTiming(startedAt)
    return res.json({ message: FORGOT_PASSWORD_GENERIC })
  }
)

router.post('/logout', (_req, res) => {
  clearAuthCookie(res)
  return res.status(204).send()
})

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  const result = await pool.query<UserRow>(
    `SELECT ${USER_SELECT_FIELDS} FROM users WHERE id = $1`,
    [req.user!.id]
  )

  if (!result.rowCount) {
    return res.status(401).json({ message: AUTH_INVALID_CREDENTIALS })
  }

  if (result.rows[0].status === 'suspended') {
    clearAuthCookie(res)
    return res.status(401).json({ message: AUTH_INVALID_CREDENTIALS })
  }

  return res.json({ user: await mapUserResponse(result.rows[0]) })
})

export default router
