import { pool } from '../db/pool.js'
import {
  DEFAULT_PIPELINE_STAGES,
  DEFAULT_STAGE_TASKS,
} from '../constants/crm-pipeline.js'
import type {
  CrmActivity,
  CrmDeal,
  CrmPipelineBoard,
  CrmStage,
  CrmTask,
  LeadScore,
} from '../types/crm.js'
import { scoreLeadWithAI } from './lead-scoring-service.js'
import { pickAssigneeForLead } from './lead-distribution-service.js'
import { getListingIntentFromInput } from '../utils/rent-estimate.js'

function mapDeal(row: Record<string, unknown>): CrmDeal {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    pipelineId: String(row.pipeline_id),
    stageId: String(row.stage_id),
    leadId: row.lead_id ? String(row.lead_id) : null,
    title: String(row.title),
    clientName: row.client_name ? String(row.client_name) : null,
    clientPhone: row.client_phone ? String(row.client_phone) : null,
    clientEmail: row.client_email ? String(row.client_email) : null,
    location: row.location ? String(row.location) : null,
    propertyType: row.property_type ? String(row.property_type) : null,
    notes: row.notes ? String(row.notes) : null,
    assigneeId: row.assignee_id ? String(row.assignee_id) : null,
    leadScore: (row.lead_score as LeadScore | null) ?? null,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    expectedTicket:
      row.expected_ticket != null ? Number(row.expected_ticket) : null,
    propertyInput: (row.property_input as Record<string, unknown> | null) ?? null,
    evaluationResult:
      (row.evaluation_result as Record<string, unknown> | null) ?? null,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at),
  }
}

export async function ensureDefaultPipeline(userId: string) {
  const existing = await pool.query<{ id: string }>(
    `SELECT id FROM crm_pipelines WHERE user_id = $1 AND is_default = true LIMIT 1`,
    [userId]
  )

  if (existing.rowCount) {
    return existing.rows[0]!.id
  }

  const pipeline = await pool.query<{ id: string }>(
    `INSERT INTO crm_pipelines (user_id, name, is_default)
     VALUES ($1, 'Pipeline principal', true)
     RETURNING id`,
    [userId]
  )

  const pipelineId = pipeline.rows[0]!.id

  for (const stage of DEFAULT_PIPELINE_STAGES) {
    await pool.query(
      `INSERT INTO crm_stages (pipeline_id, name, slug, sort_order, color)
       VALUES ($1, $2, $3, $4, $5)`,
      [pipelineId, stage.name, stage.slug, stage.sortOrder, stage.color]
    )
  }

  return pipelineId
}

export async function getPipelineBoard(userId: string): Promise<CrmPipelineBoard> {
  const pipelineId = await ensureDefaultPipeline(userId)

  const pipeline = await pool.query<{ id: string; name: string }>(
    `SELECT id, name FROM crm_pipelines WHERE id = $1`,
    [pipelineId]
  )

  const stagesResult = await pool.query<Record<string, unknown>>(
    `SELECT * FROM crm_stages WHERE pipeline_id = $1 ORDER BY sort_order ASC`,
    [pipelineId]
  )

  const dealsResult = await pool.query<Record<string, unknown>>(
    `SELECT * FROM crm_deals WHERE user_id = $1 AND pipeline_id = $2
     ORDER BY updated_at DESC`,
    [userId, pipelineId]
  )

  const dealsByStage = new Map<string, CrmDeal[]>()
  for (const row of dealsResult.rows) {
    const deal = mapDeal(row)
    const list = dealsByStage.get(deal.stageId) ?? []
    list.push(deal)
    dealsByStage.set(deal.stageId, list)
  }

  const stages = stagesResult.rows.map((row) => ({
    id: String(row.id),
    pipelineId: String(row.pipeline_id),
    name: String(row.name),
    slug: String(row.slug),
    sortOrder: Number(row.sort_order),
    color: String(row.color),
    deals: dealsByStage.get(String(row.id)) ?? [],
  }))

  return {
    pipeline: {
      id: pipeline.rows[0]!.id,
      name: pipeline.rows[0]!.name,
    },
    stages,
  }
}

async function logActivity(input: {
  dealId: string
  userId: string | null
  activityType: string
  title: string
  body?: string
  metadata?: Record<string, unknown>
}) {
  await pool.query(
    `INSERT INTO crm_activities (deal_id, user_id, activity_type, title, body, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      input.dealId,
      input.userId,
      input.activityType,
      input.title,
      input.body ?? null,
      JSON.stringify(input.metadata ?? {}),
    ]
  )
}

async function seedStageTasks(dealId: string, stageSlug: string, userId: string) {
  const tasks = DEFAULT_STAGE_TASKS[stageSlug] ?? []
  const stage = await pool.query<{ id: string }>(
    `SELECT s.id FROM crm_stages s
     JOIN crm_deals d ON d.pipeline_id = s.pipeline_id
     WHERE d.id = $1 AND s.slug = $2`,
    [dealId, stageSlug]
  )

  for (const title of tasks) {
    await pool.query(
      `INSERT INTO crm_tasks (deal_id, stage_id, title, assignee_id, due_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '2 days')`,
      [dealId, stage.rows[0]?.id ?? null, title, userId]
    )
  }
}

export async function createDealFromLead(userId: string, leadId: string) {
  const lead = await pool.query<Record<string, unknown>>(
    `SELECT * FROM leads WHERE id = $1`,
    [leadId]
  )

  if (!lead.rowCount) {
    throw new Error('Lead não encontrado.')
  }

  const row = lead.rows[0]!
  const propertyInput = (row.property_input as Record<string, unknown> | null) ?? null
  const evaluationResult =
    (row.evaluation_result as Record<string, unknown> | null) ?? null

  const listingIntent = getListingIntentFromInput(propertyInput)
  const estimatedValue =
    typeof evaluationResult?.estimatedValue === 'number'
      ? evaluationResult.estimatedValue
      : null
  const evaluationScore =
    typeof evaluationResult?.score === 'number' ? evaluationResult.score : null

  const leadScore = await scoreLeadWithAI({
    name: row.name ? String(row.name) : null,
    phone: String(row.phone),
    propertyType: row.property_type ? String(row.property_type) : null,
    interest: row.interest ? String(row.interest) : null,
    budget: row.budget ? String(row.budget) : null,
    location: row.location ? String(row.location) : null,
    listingIntent,
    estimatedValue,
    evaluationScore,
  })

  const assigneeId = await pickAssigneeForLead({
    leadId,
    location: row.location ? String(row.location) : null,
    propertyType: row.property_type ? String(row.property_type) : null,
    fallbackUserId: userId,
  })

  await pool.query(
    `UPDATE leads SET lead_score = $1, tags = $2, assignee_id = $3 WHERE id = $4`,
    [JSON.stringify(leadScore), leadScore.tags, assigneeId, leadId]
  )

  const pipelineId = await ensureDefaultPipeline(userId)
  const firstStage = await pool.query<{ id: string; slug: string }>(
    `SELECT id, slug FROM crm_stages WHERE pipeline_id = $1 ORDER BY sort_order ASC LIMIT 1`,
    [pipelineId]
  )

  const title = `${row.property_type ?? 'Imóvel'} — ${row.location ?? 'Sem local'}`
  const deal = await pool.query<Record<string, unknown>>(
    `INSERT INTO crm_deals (
       user_id, pipeline_id, stage_id, lead_id, title,
       client_name, client_phone, client_email, location, property_type,
       assignee_id, lead_score, tags, property_input, evaluation_result, expected_ticket
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING *`,
    [
      userId,
      pipelineId,
      firstStage.rows[0]!.id,
      leadId,
      title,
      row.name ?? null,
      row.phone,
      row.email ?? null,
      row.location ?? null,
      row.property_type ?? null,
      assigneeId,
      JSON.stringify(leadScore),
      leadScore.tags,
      propertyInput,
      evaluationResult,
      leadScore.expectedTicket,
    ]
  )

  const mapped = mapDeal(deal.rows[0]!)
  await logActivity({
    dealId: mapped.id,
    userId,
    activityType: 'deal_created',
    title: 'Lead adicionado ao pipeline',
    body: `Score IA: ${leadScore.probability}% probabilidade · Urgência ${leadScore.urgency}`,
    metadata: { leadScore, assigneeId },
  })

  await seedStageTasks(mapped.id, firstStage.rows[0]!.slug, assigneeId)

  return mapped
}

export async function moveDealStage(
  userId: string,
  dealId: string,
  stageId: string
) {
  const stage = await pool.query<{ id: string; slug: string; name: string }>(
    `SELECT id, slug, name FROM crm_stages WHERE id = $1`,
    [stageId]
  )

  if (!stage.rowCount) throw new Error('Etapa inválida.')

  const updated = await pool.query<Record<string, unknown>>(
    `UPDATE crm_deals
     SET stage_id = $1, updated_at = NOW()
     WHERE id = $2 AND user_id = $3
     RETURNING *`,
    [stageId, dealId, userId]
  )

  if (!updated.rowCount) throw new Error('Negócio não encontrado.')

  await logActivity({
    dealId,
    userId,
    activityType: 'stage_changed',
    title: `Movido para ${stage.rows[0]!.name}`,
  })

  await seedStageTasks(dealId, stage.rows[0]!.slug, userId)

  return mapDeal(updated.rows[0]!)
}

export async function rescoreDeal(userId: string, dealId: string) {
  const dealResult = await pool.query<Record<string, unknown>>(
    `SELECT * FROM crm_deals WHERE id = $1 AND user_id = $2`,
    [dealId, userId]
  )

  if (!dealResult.rowCount) throw new Error('Negócio não encontrado.')

  const deal = dealResult.rows[0]!
  const evaluationResult =
    (deal.evaluation_result as Record<string, unknown> | null) ?? null

  const leadScore = await scoreLeadWithAI({
    name: deal.client_name ? String(deal.client_name) : null,
    phone: deal.client_phone ? String(deal.client_phone) : null,
    propertyType: deal.property_type ? String(deal.property_type) : null,
    interest: deal.notes ? String(deal.notes) : null,
    budget: deal.expected_ticket ? String(deal.expected_ticket) : null,
    location: deal.location ? String(deal.location) : null,
    estimatedValue:
      typeof evaluationResult?.estimatedValue === 'number'
        ? evaluationResult.estimatedValue
        : null,
    evaluationScore:
      typeof evaluationResult?.score === 'number' ? evaluationResult.score : null,
  })

  const updated = await pool.query<Record<string, unknown>>(
    `UPDATE crm_deals
     SET lead_score = $1, tags = $2, expected_ticket = $3, updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [
      JSON.stringify(leadScore),
      leadScore.tags,
      leadScore.expectedTicket,
      dealId,
    ]
  )

  await logActivity({
    dealId,
    userId,
    activityType: 'score_updated',
    title: 'Lead reavaliado pela IA',
    body: `${leadScore.probability}% · ${leadScore.interest}`,
    metadata: { leadScore },
  })

  return mapDeal(updated.rows[0]!)
}

export async function getDealDetails(userId: string, dealId: string) {
  const dealResult = await pool.query<Record<string, unknown>>(
    `SELECT * FROM crm_deals WHERE id = $1 AND user_id = $2`,
    [dealId, userId]
  )

  if (!dealResult.rowCount) return null

  const activities = await pool.query<Record<string, unknown>>(
    `SELECT * FROM crm_activities WHERE deal_id = $1 ORDER BY created_at DESC`,
    [dealId]
  )

  const tasks = await pool.query<Record<string, unknown>>(
    `SELECT * FROM crm_tasks WHERE deal_id = $1 ORDER BY due_at ASC NULLS LAST`,
    [dealId]
  )

  return {
    deal: mapDeal(dealResult.rows[0]!),
    activities: activities.rows.map(
      (row): CrmActivity => ({
        id: String(row.id),
        dealId: String(row.deal_id),
        userId: row.user_id ? String(row.user_id) : null,
        activityType: String(row.activity_type),
        title: String(row.title),
        body: row.body ? String(row.body) : null,
        metadata: (row.metadata as Record<string, unknown>) ?? {},
        createdAt:
          row.created_at instanceof Date
            ? row.created_at.toISOString()
            : String(row.created_at),
      })
    ),
    tasks: tasks.rows.map(
      (row): CrmTask => ({
        id: String(row.id),
        dealId: String(row.deal_id),
        stageId: row.stage_id ? String(row.stage_id) : null,
        title: String(row.title),
        description: row.description ? String(row.description) : null,
        dueAt: row.due_at
          ? row.due_at instanceof Date
            ? row.due_at.toISOString()
            : String(row.due_at)
          : null,
        reminderAt: row.reminder_at
          ? row.reminder_at instanceof Date
            ? row.reminder_at.toISOString()
            : String(row.reminder_at)
          : null,
        completedAt: row.completed_at
          ? row.completed_at instanceof Date
            ? row.completed_at.toISOString()
            : String(row.completed_at)
          : null,
        assigneeId: row.assignee_id ? String(row.assignee_id) : null,
        createdAt:
          row.created_at instanceof Date
            ? row.created_at.toISOString()
            : String(row.created_at),
      })
    ),
  }
}

export async function completeTask(userId: string, taskId: string) {
  const result = await pool.query<{ deal_id: string; title: string }>(
    `UPDATE crm_tasks SET completed_at = NOW()
     WHERE id = $1
     RETURNING deal_id, title`,
    [taskId]
  )

  if (!result.rowCount) throw new Error('Tarefa não encontrada.')

  await logActivity({
    dealId: result.rows[0]!.deal_id,
    userId,
    activityType: 'task_completed',
    title: `Tarefa concluída: ${result.rows[0]!.title}`,
  })
}

export async function updateDealNotes(
  userId: string,
  dealId: string,
  notes: string
) {
  await pool.query(
    `UPDATE crm_deals SET notes = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
    [notes, dealId, userId]
  )

  await logActivity({
    dealId,
    userId,
    activityType: 'note_updated',
    title: 'Notas atualizadas',
    body: notes,
  })
}

export type { CrmStage }
