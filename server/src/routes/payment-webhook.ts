import type { Request, Response } from 'express'
import {
  handleEfiNotificationToken,
  handlePixWebhookPayload,
} from '../services/payment-service.js'

/**
 * Webhook da API Cobranças (cartão/assinatura).
 * A Efí envia POST com `notification` (token); consultamos o detalhe via API.
 */
export async function efiChargesWebhookHandler(req: Request, res: Response) {
  const token =
    (typeof req.body?.notification === 'string'
      ? req.body.notification
      : undefined) ??
    (typeof req.query.notification === 'string'
      ? req.query.notification
      : undefined)

  if (!token) {
    return res.status(400).json({ message: 'Token de notificação ausente.' })
  }

  try {
    const result = await handleEfiNotificationToken(token)

    if (result.reason === 'duplicate') {
      return res.status(200).json({ ok: true, duplicate: true })
    }

    return res.status(200).json({ ok: true, ...result })
  } catch (error) {
    console.error('Erro no webhook Efí Cobranças:', error)
    return res.status(500).json({ message: 'Erro ao processar webhook.' })
  }
}

/**
 * Webhook da API Pix.
 * A Efí envia POST para {url}/pix com o payload de Pix recebidos.
 */
export async function efiPixWebhookHandler(req: Request, res: Response) {
  try {
    const result = await handlePixWebhookPayload(
      req.body as {
        pix?: Array<{ txid?: string; valor?: string; endToEndId?: string }>
      }
    )
    return res.status(200).json({ ok: true, ...result })
  } catch (error) {
    console.error('Erro no webhook Efí Pix:', error)
    return res.status(500).json({ message: 'Erro ao processar webhook Pix.' })
  }
}
