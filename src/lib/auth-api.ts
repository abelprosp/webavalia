import { AxiosError } from 'axios'
import { api } from './api'

export type AccountType = 'pf' | 'pj'

export type AuthUser = {
  id: string
  name: string
  email: string
  role: 'admin' | 'corretor' | string
  status?: 'active' | 'suspended'
  accountType: AccountType
  document?: string | null
  companyName?: string | null
  tradeName?: string | null
  emailVerified?: boolean
  /** Saldo unificado (avaliações IA + desbloqueio de leads) */
  credits?: number
  /** @deprecated Use credits */
  leadCredits: number
  /** @deprecated Use credits */
  trialEvaluationsRemaining: number
  trialEvaluationsTotal: number
  hasActiveSubscription?: boolean
}

type AuthResponse = {
  user: AuthUser
}

export type RegisterResponse = {
  needsEmailVerification?: boolean
  message?: string
  email?: string
  user?: AuthUser
}

export async function loginRequest(email: string, password: string) {
  const { data } = await api.post<AuthResponse>('/auth/login', {
    email,
    password,
    _honeypot: '',
  })
  return data
}

export type RegisterPayload = {
  accountType: AccountType
  name: string
  email: string
  password: string
  document: string
  companyName?: string
  tradeName?: string
}

export async function registerRequest(payload: RegisterPayload) {
  const { data } = await api.post<RegisterResponse>('/auth/register', {
    ...payload,
    _honeypot: '',
  })
  return data
}

export async function verifyEmailRequest(token: string) {
  const { data } = await api.get<{ message: string; verified: boolean }>(
    '/auth/verify-email',
    { params: { token } }
  )
  return data
}

export async function resendVerificationRequest(email: string) {
  const { data } = await api.post<{ message: string }>(
    '/auth/resend-verification',
    { email, _honeypot: '' }
  )
  return data
}

export async function forgotPasswordRequest(email: string) {
  const { data } = await api.post<{ message: string }>('/auth/forgot-password', {
    email,
    _honeypot: '',
  })
  return data
}

export async function resetPasswordRequest(token: string, password: string) {
  try {
    const { data } = await api.post<{ message: string }>('/auth/reset-password', {
      token,
      password,
    })
    return data
  } catch (error) {
    if (error instanceof AxiosError) {
      const message = (error.response?.data as { message?: string })?.message
      throw new Error(message ?? 'Não foi possível redefinir a senha.')
    }
    throw error
  }
}

export async function logoutRequest() {
  await api.post('/auth/logout')
}

export async function fetchMe() {
  const { data } = await api.get<{ user: AuthUser }>('/auth/me')
  return data.user
}

export function isAdmin(user: AuthUser | null | undefined) {
  return user?.role === 'admin'
}

export function isBrokerAccount(user: AuthUser | null | undefined) {
  return user?.accountType === 'pj'
}

export function isEmailNotVerifiedError(error: unknown) {
  return (
    error instanceof AxiosError &&
    error.response?.data &&
    typeof error.response.data === 'object' &&
    'code' in error.response.data &&
    (error.response.data as { code?: string }).code === 'EMAIL_NOT_VERIFIED'
  )
}
