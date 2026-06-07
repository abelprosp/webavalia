import { api } from './api'
import type { AuthUser } from './auth-api'

export type AdminUser = AuthUser & {
  status: 'active' | 'suspended'
  evaluationsUsed: number
  createdAt: string
}

export type AdminPlan = {
  id: string
  name: string
  description: string | null
  priceCents: number
  leadCredits: number
  trialEvaluations: number
  isActive: boolean
  sortOrder: number
  priceLabel?: string
}

export type PlatformSettings = {
  trialEvaluationsTotal: number
  defaultLeadCredits: number
  registrationEnabled: boolean
}

export type AdminStats = {
  totalUsers: number
  totalCorretores: number
  totalAdmins: number
  totalEvaluationsUsed: number
  totalLeadCredits: number
  activePlans: number
}

export type CreditTransaction = {
  id: string
  amount: number
  type: string
  description: string | null
  createdAt: string
  userName: string
  userEmail: string
  adminName: string | null
}

export async function fetchAdminStats() {
  const { data } = await api.get<{ stats: AdminStats }>('/admin/stats')
  return data.stats
}

export async function fetchAdminUsers(params?: {
  search?: string
  role?: string
}) {
  const { data } = await api.get<{ users: AdminUser[] }>('/admin/users', {
    params,
  })
  return data.users
}

export async function updateAdminUser(
  id: string,
  payload: Partial<{
    name: string
    role: 'admin' | 'corretor'
    status: 'active' | 'suspended'
  }>
) {
  const { data } = await api.patch<{ user: AdminUser }>(
    `/admin/users/${id}`,
    payload
  )
  return data.user
}

export async function adjustUserCredits(
  id: string,
  amount: number,
  description?: string
) {
  const { data } = await api.post<{ leadCredits: number }>(
    `/admin/users/${id}/credits`,
    { amount, description }
  )
  return data.leadCredits
}

export async function adjustUserTrialEvaluations(id: string, remaining: number) {
  const { data } = await api.post<{ trialEvaluationsRemaining: number }>(
    `/admin/users/${id}/trial-evaluations`,
    { remaining }
  )
  return data.trialEvaluationsRemaining
}

export async function fetchAdminPlans() {
  const { data } = await api.get<{ plans: AdminPlan[] }>('/admin/plans')
  return data.plans
}

export async function createAdminPlan(payload: Omit<AdminPlan, 'id'>) {
  const { data } = await api.post<{ plan: AdminPlan }>('/admin/plans', payload)
  return data.plan
}

export async function updateAdminPlan(
  id: string,
  payload: Partial<Omit<AdminPlan, 'id'>>
) {
  const { data } = await api.patch<{ plan: AdminPlan }>(
    `/admin/plans/${id}`,
    payload
  )
  return data.plan
}

export async function deleteAdminPlan(id: string) {
  await api.delete(`/admin/plans/${id}`)
}

export async function fetchAdminSettings() {
  const { data } = await api.get<{ settings: PlatformSettings }>(
    '/admin/settings'
  )
  return data.settings
}

export async function updateAdminSettings(payload: Partial<PlatformSettings>) {
  const { data } = await api.patch<{ settings: PlatformSettings }>(
    '/admin/settings',
    payload
  )
  return data.settings
}

export async function fetchAdminTransactions(limit = 50) {
  const { data } = await api.get<{ transactions: CreditTransaction[] }>(
    '/admin/transactions',
    { params: { limit } }
  )
  return data.transactions
}

export async function fetchPublicPlans() {
  const { data } = await api.get<{ plans: AdminPlan[] }>('/plans')
  return data.plans
}
