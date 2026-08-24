import { api } from './api'

export type LeadListingIntent = 'alugar' | 'vender'

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
  listingIntent: LeadListingIntent
  estimatedValue: number | null
  displayValue: string | null
  hasEvaluation: boolean
  opportunityScore?: number | null
  appreciationScore?: number | null
  propertyInput: Record<string, unknown> | null
  evaluationResult: Record<string, unknown> | null
}

export type LeadSortMode = 'recent' | 'investment' | 'opportunity'

export async function fetchLeads(sort: LeadSortMode = 'recent') {
  const { data } = await api.get<{ leads: LeadItem[] }>('/leads', {
    params: { sort },
  })
  return data.leads
}

export async function unlockLead(leadId: string) {
  const { data } = await api.post<{
    lead: LeadItem
    credits: number
    leadCredits: number
    alreadyUnlocked: boolean
    dealId?: string | null
    addedToPipeline?: boolean
  }>(`/leads/${leadId}/unlock`)
  return {
    ...data,
    credits: data.credits ?? data.leadCredits,
    dealId: data.dealId ?? null,
    addedToPipeline: Boolean(data.addedToPipeline),
  }
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
