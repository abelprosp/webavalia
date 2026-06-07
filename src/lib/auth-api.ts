import { AxiosError } from 'axios'
import { api } from './api'

export type AuthUser = {
  id: string
  name: string
  email: string
  role: 'admin' | 'corretor' | string
  status?: 'active' | 'suspended'
  emailVerified?: boolean
  leadCredits: number
  trialEvaluationsRemaining: number
  trialEvaluationsTotal: number
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

export async function registerRequest(
  name: string,
  email: string,
  password: string
) {
  const { data } = await api.post<RegisterResponse>('/auth/register', {
    name,
    email,
    password,
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

export function isEmailNotVerifiedError(error: unknown) {
  return (
    error instanceof AxiosError &&
    error.response?.data &&
    typeof error.response.data === 'object' &&
    'code' in error.response.data &&
    (error.response.data as { code?: string }).code === 'EMAIL_NOT_VERIFIED'
  )
}
