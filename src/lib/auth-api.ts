import { api } from './api'

export type AuthUser = {
  id: string
  name: string
  email: string
  role: string
  trialEvaluationsRemaining: number
  trialEvaluationsTotal: number
}

type AuthResponse = {
  user: AuthUser
  token: string
}

export async function loginRequest(email: string, password: string) {
  const { data } = await api.post<AuthResponse>('/auth/login', {
    email,
    password,
  })
  return data
}

export async function registerRequest(
  name: string,
  email: string,
  password: string
) {
  const { data } = await api.post<AuthResponse>('/auth/register', {
    name,
    email,
    password,
  })
  return data
}

export async function fetchMe() {
  const { data } = await api.get<{ user: AuthUser }>('/auth/me')
  return data.user
}
