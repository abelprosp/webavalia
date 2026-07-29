export type LeadScore = {
  probability: number
  urgency: 'baixa' | 'media' | 'alta'
  expectedTicket: number
  interest: string
  summary: string
  tags: string[]
  scoredAt: string
}

export type CrmStage = {
  id: string
  pipelineId: string
  name: string
  slug: string
  sortOrder: number
  color: string
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

export type CrmPipelineBoard = {
  pipeline: { id: string; name: string }
  stages: Array<CrmStage & { deals: CrmDeal[] }>
}
