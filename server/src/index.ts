import path from 'path'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { fileURLToPath } from 'url'
import { config } from './config.js'
import { ensureFoxAiTables } from './db/ensure-fox-ai-tables.js'
import { webhookRateLimiter } from './middleware/rate-limit.js'
import addressRoutes from './routes/address.js'
import adminRoutes from './routes/admin.js'
import authRoutes from './routes/auth.js'
import blogRoutes from './routes/blog.js'
import captureRadarRoutes from './routes/capture-radar.js'
import crmRoutes from './routes/crm.js'
import evaluationRoutes from './routes/evaluation.js'
import foxAiRoutes from './routes/fox-ai.js'
import gamificationRoutes from './routes/gamification.js'
import leadsRoutes from './routes/leads.js'
import notificationRoutes from './routes/notifications.js'
import {
  efiChargesWebhookHandler,
  efiPixWebhookHandler,
} from './routes/payment-webhook.js'
import paymentRoutes from './routes/payments.js'
import plansRoutes from './routes/plans.js'
import {
  whatsappLeadsWebhookHandler,
  whatsappMetaWebhookHandler,
  whatsappVerifyHandler,
} from './routes/whatsapp-webhook.js'

const app = express()
const __dirname = path.dirname(fileURLToPath(import.meta.url))

app.set('trust proxy', 1)

app.use(
  helmet({
    contentSecurityPolicy: config.isProduction
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
              "'self'",
              'https://cdn.jsdelivr.net',
              'https://*.sejaefi.com.br',
              'https://*.gerencianet.com.br',
            ],
            styleSrc: [
              "'self'",
              "'unsafe-inline'",
              'https://fonts.googleapis.com',
            ],
            imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
            connectSrc: [
              "'self'",
              'https://*.sejaefi.com.br',
              'https://*.gerencianet.com.br',
              'https://cobrancas.api.efipay.com.br',
              'https://cobrancas-h.api.efipay.com.br',
            ],
            fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
          },
        }
      : false,
    crossOriginEmbedderPolicy: false,
    hsts: config.isProduction
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
  })
)

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  )
  next()
})

app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)

app.post(
  '/api/payments/webhooks/efi',
  webhookRateLimiter,
  express.urlencoded({ extended: true, limit: '256kb' }),
  express.json({ limit: '256kb' }),
  efiChargesWebhookHandler
)
app.post(
  '/api/payments/webhooks/efi/pix',
  webhookRateLimiter,
  express.json({ limit: '256kb' }),
  efiPixWebhookHandler
)

app.get('/api/webhooks/whatsapp', whatsappVerifyHandler)
app.post(
  '/api/webhooks/whatsapp',
  webhookRateLimiter,
  express.raw({ type: 'application/json', limit: '1mb' }),
  whatsappMetaWebhookHandler
)
app.post(
  '/api/webhooks/whatsapp/leads',
  webhookRateLimiter,
  express.raw({ type: 'application/json', limit: '1mb' }),
  (req, res, next) => {
    try {
      req.body =
        req.body instanceof Buffer
          ? JSON.parse(req.body.toString('utf8'))
          : req.body
      next()
    } catch {
      res.status(400).json({ message: 'Payload inválido.' })
    }
  },
  whatsappLeadsWebhookHandler
)

app.use(express.json({ limit: '8mb' }))

app.get('/api/health', (_req, res) => {
  const key = config.serperApiKey
  const serperFingerprint = !key
    ? null
    : key.length <= 8
      ? '***'
      : `${key.slice(0, 4)}…${key.slice(-4)}`

  res.json({
    status: 'ok',
    serper: {
      configured: Boolean(key),
      fingerprint: serperFingerprint,
      keyLength: key ? key.length : 0,
    },
  })
})

app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/plans', plansRoutes)
app.use('/api/evaluation', evaluationRoutes)
app.use('/api/address', addressRoutes)
app.use('/api/gamification', gamificationRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/leads', leadsRoutes)
app.use('/api/crm', crmRoutes)
app.use('/api/blog', blogRoutes)
app.use('/api/fox-ai', foxAiRoutes)
app.use('/api/radar', captureRadarRoutes)

app.use('/api', (_req, res) => {
  res.status(404).json({ message: 'Endpoint não encontrado.' })
})

app.use(((error, _req, res, next) => {
  if (res.headersSent) return next(error)
  const status =
    error?.type === 'entity.too.large'
      ? 413
      : error?.type === 'entity.parse.failed'
        ? 400
        : 500
  if (status === 500) console.error('Erro não tratado na API:', error)
  res
    .status(status)
    .json({
      message:
        status === 413
          ? 'Os dados enviados excedem o limite permitido.'
          : status === 400
            ? 'O conteúdo enviado não é um JSON válido.'
            : 'Não foi possível concluir a operação. Tente novamente.',
    })
}) as express.ErrorRequestHandler)

if (config.isProduction) {
  const frontendDist = path.join(__dirname, '../../dist')

  app.use(express.static(frontendDist))

  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'))
  })
}

app.listen(config.port, () => {
  void ensureFoxAiTables().catch((error) => {
    console.error('Falha ao garantir tabelas FoxAi na inicialização:', error)
  })
  console.log(
    config.isProduction
      ? `Avalia Imobe em produção na porta ${config.port}`
      : `API Avalia Imob rodando em http://localhost:${config.port}`
  )
  // Fingerprint só — nunca loga a chave completa
  const serperKey = config.serperApiKey
  const serperFp = !serperKey
    ? 'ausente'
    : serperKey.length <= 8
      ? '***'
      : `${serperKey.slice(0, 4)}…${serperKey.slice(-4)} (len=${serperKey.length})`
  console.log(`[serper] SERPER_API_KEY: ${serperFp}`)
})
