import { api } from './api'

export type LeadItem = {
  id: string
  name: string
  phone: string
  email: string
  propertyType: string
  interest: string
  budget: string
  location: string
  source: string
  receivedAt: string
  status: 'novo' | 'desbloqueado' | 'contatado'
  unlocked: boolean
  estimatedValue: number | null
  hasEvaluation: boolean
  propertyInput: Record<string, unknown> | null
  evaluationResult: Record<string, unknown> | null
}

export async function fetchLeads() {
  const { data } = await api.get<{ leads: LeadItem[] }>('/leads')
  return data.leads
}

export async function unlockLead(leadId: string) {
  const { data } = await api.post<{
    lead: LeadItem
    leadCredits: number
    alreadyUnlocked: boolean
  }>(`/leads/${leadId}/unlock`)
  return data
}

export async function updateLeadStatus(
  leadId: string,
  status: 'novo' | 'contatado'
) {
  const { data } = await api.patch<{ lead: LeadItem }>(`/leads/${leadId}/status`, {
    status,
  })
  return data.lead
}
