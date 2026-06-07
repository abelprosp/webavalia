import type { Request, Response } from 'express'
import { handleWebhookPayload } from '../services/payment-service.js'
import {
  verifyWebhookSecret,
  verifyWebhookSignature,
} from '../services/abacatepay-service.js'

export async function abacatePayWebhookHandler(req: Request, res: Response) {
  const rawBody =
    req.body instanceof Buffer
      ? req.body.toString('utf8')
      : typeof req.body === 'string'
        ? req.body
        : ''

  if (!verifyWebhookSecret(req.query.webhookSecret as string | undefined)) {
    return res.status(401).json({ message: 'Webhook não autorizado.' })
  }

  const signature = req.header('X-Webhook-Signature')
  if (!verifyWebhookSignature(rawBody, signature ?? undefined)) {
    return res.status(401).json({ message: 'Assinatura inválida.' })
  }

  let payload: {
    id?: string
    event?: string
    data?: Record<string, unknown>
  }

  try {
    payload = JSON.parse(rawBody)
  } catch {
    return res.status(400).json({ message: 'Payload inválido.' })
  }

  if (!payload.id || !payload.event) {
    return res.status(400).json({ message: 'Evento incompleto.' })
  }

  try {
    const result = await handleWebhookPayload({
      id: payload.id,
      event: payload.event,
      data: (payload.data ?? {}) as {
        transparent?: { externalId?: string | null; status?: string }
        checkout?: { externalId?: string | null; status?: string }
      },
    })

    if (result.reason === 'duplicate') {
      return res.status(200).json({ ok: true, duplicate: true })
    }

    return res.status(200).json({ ok: true, ...result })
  } catch (error) {
    console.error('Erro no webhook AbacatePay:', error)
    return res.status(500).json({ message: 'Erro ao processar webhook.' })
  }
}
