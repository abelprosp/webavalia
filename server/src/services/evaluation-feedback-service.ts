import { pool } from '../db/pool.js'
import {
  formatLeadBudget,
  getLeadInterestLabel,
  getListingIntentFromInput,
} from '../utils/rent-estimate.js'
import { getSetting } from './settings-service.js'
import { createLead } from './lead-service.js'

type StoredPropertyInput = Record<string, unknown>

type StoredEvaluationResult = Record<string, unknown>

export async function isEvaluationFeedbackModeEnabled() {
  if (process.env.EVALUATION_FEEDBACK_MODE === 'false') return false
  if (process.env.EVALUATION_FEEDBACK_MODE === 'true') return true
  return getSetting<boolean>('evaluation_feedback_mode', true)
}

function sanitizePropertyInput(input: Record<string, unknown>) {
  const { photos, ...rest } = input
  return {
    ...rest,
    photoCount: Array.isArray(photos) ? photos.length : 0,
  }
}

export async function savePropertyEvaluation(input: {
  userId: string
  propertyInput: Record<string, unknown>
  evaluationResult: Record<string, unknown>
}) {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO property_evaluations (user_id, property_input, evaluation_result)
     VALUES ($1, $2::jsonb, $3::jsonb)
     RETURNING id`,
    [
      input.userId,
      JSON.stringify(sanitizePropertyInput(input.propertyInput)),
      JSON.stringify(input.evaluationResult),
    ]
  )

  return result.rows[0].id
}

export async function submitEvaluationFeedback(input: {
  evaluationId: string
  userId: string
  rating: 'good' | 'bad'
  comment: string
}) {
  const owner = await pool.query<{ user_id: string }>(
    `SELECT user_id FROM property_evaluations WHERE id = $1`,
    [input.evaluationId]
  )

  if (!owner.rowCount) {
    throw new Error('Avaliação não encontrada.')
  }

  if (owner.rows[0].user_id !== input.userId) {
    throw new Error('Avaliação não encontrada.')
  }

  const existing = await pool.query(
    `SELECT id FROM evaluation_feedback WHERE evaluation_id = $1`,
    [input.evaluationId]
  )

  if (existing.rowCount) {
    throw new Error('Feedback já enviado para esta avaliação.')
  }

  await pool.query(
    `INSERT INTO evaluation_feedback (evaluation_id, user_id, rating, comment)
     VALUES ($1, $2, $3, $4)`,
    [input.evaluationId, input.userId, input.rating, input.comment.trim()]
  )
}

function getPublicLocation(propertyInput: StoredPropertyInput) {
  const address =
    typeof propertyInput.address === 'string'
      ? propertyInput.address.trim()
      : ''
  const locality = address.includes('—')
    ? address.split('—').slice(1).join('—').trim()
    : address
  const parts = locality
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length >= 2) return parts.slice(-2).join(', ')
  return locality || 'Localização não informada'
}

export async function publishEvaluationAsLead(input: {
  evaluationId: string
  userId: string
  phone: string
}) {
  const result = await pool.query<{
    property_input: StoredPropertyInput
    evaluation_result: StoredEvaluationResult
    name: string
    email: string
    account_type: string
  }>(
    `SELECT e.property_input, e.evaluation_result,
            u.name, u.email, u.account_type
     FROM property_evaluations e
     JOIN users u ON u.id = e.user_id
     WHERE e.id = $1 AND e.user_id = $2`,
    [input.evaluationId, input.userId]
  )

  if (!result.rowCount) {
    throw new Error('Avaliação não encontrada.')
  }

  const evaluation = result.rows[0]
  if (evaluation.account_type !== 'pf') {
    throw new Error('Esta opção está disponível apenas para proprietários.')
  }

  const listingIntent = getListingIntentFromInput(evaluation.property_input)
  const estimatedValue = evaluation.evaluation_result.estimatedValue
  const budget =
    typeof estimatedValue === 'number'
      ? formatLeadBudget(
          listingIntent,
          estimatedValue,
          evaluation.property_input
        )
      : undefined

  return createLead({
    externalId: `evaluation-${input.evaluationId}`,
    name: evaluation.name,
    phone: input.phone,
    email: evaluation.email,
    propertyType:
      typeof evaluation.property_input.propertyType === 'string'
        ? evaluation.property_input.propertyType
        : undefined,
    interest: getLeadInterestLabel(listingIntent),
    budget,
    location: getPublicLocation(evaluation.property_input),
    source: 'owner_evaluation',
    propertyInput: evaluation.property_input,
    evaluationResult: evaluation.evaluation_result,
    rawPayload: {
      evaluationId: input.evaluationId,
      ownerUserId: input.userId,
      consent: true,
      consentedAt: new Date().toISOString(),
    },
  })
}

type FeedbackLearningRow = {
  rating: 'good' | 'bad'
  comment: string
  property_input: StoredPropertyInput
  evaluation_result: StoredEvaluationResult
}

function summarizeProperty(input: StoredPropertyInput) {
  const parts = [
    input.propertyType,
    input.area ? `${input.area} m²` : null,
    input.address,
    input.standardLevel ? `padrão ${input.standardLevel}` : null,
    input.finishLevel ? `acabamento ${input.finishLevel}` : null,
    typeof input.askingPrice === 'number'
      ? `valor pedido R$ ${input.askingPrice.toLocaleString('pt-BR')}`
      : null,
    Array.isArray(input.amenities) && input.amenities.length > 0
      ? `diferenciais: ${input.amenities.join(', ')}`
      : null,
  ].filter(Boolean)

  return parts.join(' · ') || 'Imóvel não especificado'
}

function summarizeResult(result: StoredEvaluationResult) {
  const value =
    typeof result.estimatedValue === 'number'
      ? `R$ ${result.estimatedValue.toLocaleString('pt-BR')}`
      : 'valor não informado'
  const valuePerSqm =
    typeof result.valuePerSqm === 'number'
      ? `${result.valuePerSqm.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/m²`
      : null
  const marketAvg =
    typeof result.marketAnalysis === 'object' &&
    result.marketAnalysis !== null &&
    typeof (result.marketAnalysis as { averagePricePerSqm?: unknown })
      .averagePricePerSqm === 'number'
      ? `média mercado ${(
          (result.marketAnalysis as { averagePricePerSqm: number })
            .averagePricePerSqm
        ).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/m²`
      : null
  const score =
    typeof result.score === 'number' ? `score ${result.score}/100` : null

  return [value, valuePerSqm, marketAvg, score].filter(Boolean).join(' · ')
}

export async function buildFeedbackLearningPrompt(limit = 12) {
  const result = await pool.query<FeedbackLearningRow>(
    `SELECT f.rating, f.comment, e.property_input, e.evaluation_result
     FROM evaluation_feedback f
     JOIN property_evaluations e ON e.id = f.evaluation_id
     ORDER BY
       CASE WHEN f.rating = 'bad' THEN 0 ELSE 1 END,
       CASE
         WHEN f.comment ~* '(baixo|alto|subestim|superestim|valor|preço|preco|caro|barato)'
         THEN 0
         ELSE 1
       END,
       char_length(f.comment) DESC,
       f.created_at DESC
     LIMIT $1`,
    [limit]
  )

  if (!result.rowCount) {
    return ''
  }

  const examples = result.rows
    .map((row, index) => {
      const label = row.rating === 'good' ? 'ACERTO' : 'ERRO'
      return `${index + 1}. [${label}]
Imóvel: ${summarizeProperty(row.property_input)}
Avaliação gerada: ${summarizeResult(row.evaluation_result)}
Feedback do corretor: ${row.comment}`
    })
    .join('\n\n')

  return `

--- APRENDIZADO COM FEEDBACK DE CORRETORES (PRIORIDADE ALTA) ---
Estes são feedbacks reais de corretores sobre avaliações anteriores. Eles têm PRIORIDADE sobre suposições genéricas.
Use-os para calibrar valor estimado, valor/m², comparáveis, score e insights.
Quando o feedback indicar valor baixo/alto, ajuste a metodologia para imóveis similares (mesmo bairro, tipo e padrão).
Evite repetir erros apontados. Reforce padrões elogiados quando o imóvel for similar.
Se o corretor disser que o valor ficou baixo, revise se você confundiu preço total com preço/m² ou aplicou descontos excessivos.

${examples}
`
}

export async function getFeedbackStats() {
  const result = await pool.query<{
    total: string
    good: string
    bad: string
  }>(`
    SELECT
      COUNT(*)::text AS total,
      COUNT(*) FILTER (WHERE rating = 'good')::text AS good,
      COUNT(*) FILTER (WHERE rating = 'bad')::text AS bad
    FROM evaluation_feedback
  `)

  return {
    total: Number(result.rows[0]?.total ?? 0),
    good: Number(result.rows[0]?.good ?? 0),
    bad: Number(result.rows[0]?.bad ?? 0),
  }
}
