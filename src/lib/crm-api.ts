import { api } from './api'

export type LeadScore = {
  probability: number
  urgency: 'baixa' | 'media' | 'alta'
  expectedTicket: number
  interest: string
  summary: string
  tags: string[]
  scoredAt: string
}

export type CrmDeal = {
  id: string
  userId: string
  pipelineId: string
  stageId: string
  leadId: string | null
  title: string
  clientName: string | null
  clientPhone: string | null
  clientEmail: string | null
  location: string | null
  propertyType: string | null
  notes: string | null
  assigneeId: string | null
  leadScore: LeadScore | null
  tags: string[]
  expectedTicket: number | null
  propertyInput: Record<string, unknown> | null
  evaluationResult: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export type CrmStage = {
  id: string
  pipelineId: string
  name: string
  slug: string
  sortOrder: number
  color: string
  deals: CrmDeal[]
}

export type CrmPipelineBoard = {
  pipeline: { id: string; name: string }
  stages: CrmStage[]
}

export type CrmActivity = {
  id: string
  dealId: string
  userId: string | null
  activityType: string
  title: string
  body: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export type CrmTask = {
  id: string
  dealId: string
  stageId: string | null
  title: string
  description: string | null
  dueAt: string | null
  reminderAt: string | null
  completedAt: string | null
  assigneeId: string | null
  createdAt: string
}

export async function fetchPipelineBoard() {
  const { data } = await api.get<CrmPipelineBoard>('/crm/pipeline')
  return data
}

export async function createDealFromLead(leadId: string) {
  const { data } = await api.post<{ deal: CrmDeal }>(`/crm/deals/from-lead/${leadId}`)
  return data.deal
}

export async function moveDealStage(dealId: string, stageId: string) {
  const { data } = await api.patch<{ deal: CrmDeal }>(`/crm/deals/${dealId}/stage`, {
    stageId,
  })
  return data.deal
}

export async function fetchDealDetails(dealId: string) {
  const { data } = await api.get<{
    deal: CrmDeal
    activities: CrmActivity[]
    tasks: CrmTask[]
  }>(`/crm/deals/${dealId}`)
  return data
}

export async function rescoreDeal(dealId: string) {
  const { data } = await api.post<{ deal: CrmDeal }>(`/crm/deals/${dealId}/score`)
  return data.deal
}

export async function updateDealNotes(dealId: string, notes: string) {
  await api.patch(`/crm/deals/${dealId}/notes`, { notes })
}

export async function completeCrmTask(taskId: string) {
  await api.patch(`/crm/tasks/${taskId}/complete`)
}

export function getUrgencyLabel(urgency: LeadScore['urgency']) {
  switch (urgency) {
    case 'alta':
      return 'Alta'
    case 'media':
      return 'Média'
    default:
      return 'Baixa'
  }
}
