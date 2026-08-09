import type { Request, Response } from 'express'
import { config } from '../config.js'
import {
  ingestMetaWhatsAppPayload,
  ingestWhatsAppLeadEvaluation,
  verifyMetaSignature,
  verifyWhatsAppWebhookSecret,
} from '../services/whatsapp-webhook-service.js'

export function whatsappVerifyHandler(req: Request, res: Response) {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (
    mode === 'subscribe' &&
    typeof token === 'string' &&
    token === config.whatsapp.verifyToken &&
    config.whatsapp.verifyToken
  ) {
    return res.status(200).send(String(challenge ?? ''))
  }

  return res.status(403).json({ message: 'Verificação inválida.' })
}

export async function whatsappMetaWebhookHandler(req: Request, res: Response) {
  const rawBody =
    req.body instanceof Buffer
      ? req.body.toString('utf8')
      : typeof req.body === 'string'
        ? req.body
        : ''

  if (config.isProduction && !config.whatsapp.appSecret) {
    console.error(
      '[whatsapp] WHATSAPP_APP_SECRET ausente em produção — webhook Meta rejeitado.'
    )
    return res.status(503).json({
      message: 'Webhook WhatsApp não configurado com segurança.',
    })
  }

  if (config.whatsapp.appSecret) {
    const signature = req.header('X-Hub-Signature-256')
    if (!verifyMetaSignature(rawBody, signature ?? undefined)) {
      return res.status(401).json({ message: 'Assinatura inválida.' })
    }
  } else {
    // Em desenvolvimento, exige ao menos o secret se estiver definido;
    // sem secret, rejeita para evitar ingestão aberta acidental.
    return res.status(401).json({
      message: 'WHATSAPP_APP_SECRET não configurado.',
    })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return res.status(400).json({ message: 'Payload inválido.' })
  }

  try {
    const result = await ingestMetaWhatsAppPayload(
      payload as Parameters<typeof ingestMetaWhatsAppPayload>[0]
    )
    return res.status(200).json({ ok: true, ...result })
  } catch (error) {
    console.error('Erro no webhook WhatsApp (Meta):', error)
    return res.status(500).json({ message: 'Erro ao processar webhook.' })
  }
}

export async function whatsappLeadsWebhookHandler(req: Request, res: Response) {
  const webhookSecret =
    req.header('X-Webhook-Secret') ??
    (typeof req.query.webhookSecret === 'string'
      ? req.query.webhookSecret
      : undefined)

  if (!verifyWhatsAppWebhookSecret(webhookSecret)) {
    return res.status(401).json({ message: 'Webhook não autorizado.' })
  }

  try {
    const result = await ingestWhatsAppLeadEvaluation(req.body)
    return res.status(result.duplicate ? 200 : 201).json({
      ok: true,
      ...result,
      leadId: result.lead?.id ?? null,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erro ao processar lead.'
    return res.status(400).json({ message })
  }
}
