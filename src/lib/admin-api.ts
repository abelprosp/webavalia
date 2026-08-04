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
  evaluationFeedbackMode: boolean
}

export type AdminStats = {
  totalUsers: number
  totalCorretores: number
  totalAdmins: number
  totalPfUsers: number
  totalPjUsers: number
  totalEvaluationsUsed: number
  totalLeadCredits: number
  activePlans: number
  evaluationFeedbackTotal?: number
  evaluationFeedbackGood?: number
  evaluationFeedbackBad?: number
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

export type AdminBlogPost = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  content: string
  status: 'draft' | 'published'
  authorId: string | null
  authorName: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export type AdminEvaluationListItem = {
  id: string
  userId: string
  userName: string
  userEmail: string
  accountType: string
  address: string
  propertyType: string | null
  estimatedValue: number | null
  score: number | null
  floodRiskLevel: string | null
  hasEvaluationFeedback: boolean
  evaluationFeedbackRating: 'good' | 'bad' | null
  floodFeedbackCount: number
  createdAt: string
}

export type AdminEvaluationDetail = AdminEvaluationListItem & {
  propertyInput: Record<string, unknown>
  evaluationResult: Record<string, unknown>
  evaluationFeedback: {
    id: string
    rating: 'good' | 'bad'
    comment: string
    createdAt: string
  } | null
  floodFeedbacks: {
    id: string
    userId: string
    userName: string
    userEmail: string
    gotWater: boolean
    severity: 'baixo' | 'moderado' | 'alto' | null
    comment: string | null
    addressDisplay: string
    createdAt: string
  }[]
}

export type AdminFeedbackListItem = {
  id: string
  type: 'evaluation' | 'flood'
  createdAt: string
  userId: string
  userName: string
  userEmail: string
  evaluationId: string | null
  address: string | null
  rating: 'good' | 'bad' | null
  gotWater: boolean | null
  severity: 'baixo' | 'moderado' | 'alto' | null
  comment: string | null
}

export async function fetchAdminStats() {
  const { data } = await api.get<{ stats: AdminStats }>('/admin/stats')
  return data.stats
}

export async function fetchAdminUsers(params?: {
  search?: string
  role?: string
  accountType?: string
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
  const { data } = await api.post<{
    credits?: number
    leadCredits: number
  }>(`/admin/users/${id}/credits`, { amount, description })
  return data.credits ?? data.leadCredits
}

export async function adjustUserTrialEvaluations(id: string, remaining: number) {
  const { data } = await api.post<{
    credits?: number
    trialEvaluationsRemaining: number
  }>(`/admin/users/${id}/trial-evaluations`, { remaining })
  return data.credits ?? data.trialEvaluationsRemaining
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

export async function fetchAdminBlogPosts() {
  const { data } = await api.get<{ posts: AdminBlogPost[] }>('/admin/blog')
  return data.posts
}

export async function createAdminBlogPost(payload: {
  title: string
  excerpt?: string | null
  content: string
  status: 'draft' | 'published'
  slug?: string
}) {
  const { data } = await api.post<{ post: AdminBlogPost }>('/admin/blog', payload)
  return data.post
}

export async function updateAdminBlogPost(
  id: string,
  payload: Partial<{
    title: string
    excerpt: string | null
    content: string
    status: 'draft' | 'published'
    slug: string
  }>
) {
  const { data } = await api.patch<{ post: AdminBlogPost }>(
    `/admin/blog/${id}`,
    payload
  )
  return data.post
}

export async function deleteAdminBlogPost(id: string) {
  await api.delete(`/admin/blog/${id}`)
}

export async function fetchAdminEvaluations(params?: {
  search?: string
  limit?: number
  offset?: number
}) {
  const { data } = await api.get<{
    total: number
    evaluations: AdminEvaluationListItem[]
  }>('/admin/evaluations', { params })
  return data
}

export async function fetchAdminEvaluation(id: string) {
  const { data } = await api.get<{ evaluation: AdminEvaluationDetail }>(
    `/admin/evaluations/${id}`
  )
  return data.evaluation
}

export async function fetchAdminFeedbacks(params?: {
  limit?: number
  offset?: number
}) {
  const { data } = await api.get<{
    total: number
    feedbacks: AdminFeedbackListItem[]
  }>('/admin/feedbacks', { params })
  return data
}
