import type { Request, Response } from 'express'
import { handleAsaasWebhookPayload } from '../services/payment-service.js'
import { verifyAsaasWebhookToken } from '../services/asaas-service.js'

export async function asaasWebhookHandler(req: Request, res: Response) {
  const token =
    req.header('asaas-access-token') ??
    (typeof req.query.access_token === 'string'
      ? req.query.access_token
      : undefined)

  if (!verifyAsaasWebhookToken(token)) {
    return res.status(401).json({ message: 'Webhook não autorizado.' })
  }

  const payload = req.body as {
    id?: string
    event?: string
    payment?: {
      id: string
      status: string
      externalReference?: string | null
      subscription?: string | null
      value?: number
    }
  }

  if (!payload.id || !payload.event) {
    return res.status(400).json({ message: 'Evento incompleto.' })
  }

  try {
    const result = await handleAsaasWebhookPayload({
      id: payload.id,
      event: payload.event,
      payment: payload.payment,
    })

    if (result.reason === 'duplicate') {
      return res.status(200).json({ ok: true, duplicate: true })
    }

    return res.status(200).json({ ok: true, ...result })
  } catch (error) {
    console.error('Erro no webhook Asaas:', error)
    return res.status(500).json({ message: 'Erro ao processar webhook.' })
  }
}
