import { createHmac, timingSafeEqual } from 'node:crypto'
import { config } from '../config.js'
import { registerWebhookEvent } from './payment-service.js'
import { createLead } from './lead-service.js'

export function verifyWhatsAppWebhookSecret(secret: string | undefined) {
  if (!config.whatsapp.webhookSecret) {
    return !config.isProduction
  }
  if (!secret) return false

  const expected = Buffer.from(config.whatsapp.webhookSecret)
  const received = Buffer.from(secret)
  if (expected.length !== received.length) return false

  return timingSafeEqual(expected, received)
}

export function verifyMetaSignature(rawBody: string, signature: string | undefined) {
  if (!config.whatsapp.appSecret || !signature) return false

  const expected =
    'sha256=' +
    createHmac('sha256', config.whatsapp.appSecret)
      .update(rawBody)
      .digest('hex')

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

type LeadEvaluationPayload = {
  eventId?: string
  id?: string
  name?: string
  phone?: string
  email?: string
  propertyType?: string
  interest?: string
  budget?: string
  location?: string
  address?: string
  property?: Record<string, unknown>
  propertyInput?: Record<string, unknown>
  evaluation?: Record<string, unknown>
  evaluationResult?: Record<string, unknown>
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, '')
}

function extractPropertyType(input: Record<string, unknown> | undefined) {
  if (!input) return undefined
  const value = input.propertyType ?? input.property_type
  return typeof value === 'string' ? value : undefined
}

function extractLocation(
  payload: LeadEvaluationPayload,
  propertyInput?: Record<string, unknown>
) {
  if (payload.location) return payload.location
  if (payload.address) return payload.address

  const fromProperty = propertyInput?.address
  return typeof fromProperty === 'string' ? fromProperty : undefined
}

function formatBudget(value: unknown) {
  if (typeof value === 'number') {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }
  if (typeof value === 'string' && value.trim()) return value
  return undefined
}

export async function ingestWhatsAppLeadEvaluation(
  payload: LeadEvaluationPayload
) {
  const eventId = payload.eventId ?? payload.id
  if (!eventId) {
    throw new Error('eventId é obrigatório.')
  }

  if (!payload.phone) {
    throw new Error('phone é obrigatório.')
  }

  const isNew = await registerWebhookEvent(
    `whatsapp:lead:${eventId}`,
    'whatsapp.lead_evaluation'
  )
  if (!isNew) {
    return { created: false, duplicate: true, lead: null }
  }

  const propertyInput =
    payload.propertyInput ??
    payload.property ??
    undefined

  const evaluationResult =
    payload.evaluationResult ?? payload.evaluation ?? undefined

  const askingPrice = propertyInput?.askingPrice
  const budget =
    payload.budget ?? formatBudget(askingPrice) ?? formatBudget(evaluationResult?.estimatedValue)

  const result = await createLead({
    externalId: eventId,
    name: payload.name,
    phone: normalizePhone(payload.phone),
    email: payload.email,
    propertyType: payload.propertyType ?? extractPropertyType(propertyInput),
    interest: payload.interest ?? 'Avaliação via WhatsApp',
    budget,
    location: extractLocation(payload, propertyInput),
    propertyInput,
    evaluationResult,
    rawPayload: payload as Record<string, unknown>,
  })

  return {
    created: result.created,
    duplicate: !result.created,
    lead: result.lead,
  }
}

type MetaWebhookPayload = {
  object?: string
  entry?: Array<{
    changes?: Array<{
      field?: string
      value?: {
        contacts?: Array<{
          profile?: { name?: string }
          wa_id?: string
        }>
        messages?: Array<{
          id?: string
          from?: string
          type?: string
          text?: { body?: string }
        }>
      }
    }>
  }>
}

export async function ingestMetaWhatsAppPayload(payload: MetaWebhookPayload) {
  if (payload.object !== 'whatsapp_business_account') {
    return { processed: 0, created: 0 }
  }

  let processed = 0
  let created = 0

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue

      const value = change.value
      const contactName = value?.contacts?.[0]?.profile?.name

      for (const message of value?.messages ?? []) {
        if (!message.id || !message.from) continue

        processed += 1

        const isNew = await registerWebhookEvent(
          `whatsapp:meta:${message.id}`,
          'whatsapp.meta_message'
        )
        if (!isNew) continue

        const body = message.text?.body?.trim()
        const result = await createLead({
          externalId: message.id,
          name: contactName,
          phone: normalizePhone(message.from),
          interest: body || 'Mensagem WhatsApp',
          location: '—',
          rawPayload: message as unknown as Record<string, unknown>,
        })

        if (result.created) created += 1
      }
    }
  }

  return { processed, created }
}
