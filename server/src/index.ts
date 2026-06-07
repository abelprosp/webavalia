import path from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { config } from './config.js'
import authRoutes from './routes/auth.js'
import adminRoutes from './routes/admin.js'
import plansRoutes from './routes/plans.js'
import evaluationRoutes from './routes/evaluation.js'
import gamificationRoutes from './routes/gamification.js'
import paymentRoutes from './routes/payments.js'
import { abacatePayWebhookHandler } from './routes/payment-webhook.js'
import { webhookRateLimiter } from './middleware/rate-limit.js'

const app = express()
const __dirname = path.dirname(fileURLToPath(import.meta.url))

app.set('trust proxy', 1)

app.use(
  helmet({
    contentSecurityPolicy: config.isProduction
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: [
              "'self'",
              "'unsafe-inline'",
              'https://fonts.googleapis.com',
            ],
            imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
            connectSrc: ["'self'"],
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
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
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
  '/api/payments/webhooks/abacatepay',
  webhookRateLimiter,
  express.raw({ type: 'application/json', limit: '256kb' }),
  abacatePayWebhookHandler
)

app.use(express.json({ limit: '8mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/plans', plansRoutes)
app.use('/api/evaluation', evaluationRoutes)
app.use('/api/gamification', gamificationRoutes)
app.use('/api/payments', paymentRoutes)

if (config.isProduction) {
  const frontendDist = path.join(__dirname, '../../dist')

  app.use(express.static(frontendDist))

  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'))
  })
}

app.listen(config.port, () => {
  console.log(
    config.isProduction
      ? `Avalia Imobe em produção na porta ${config.port}`
      : `API Avalia Imob rodando em http://localhost:${config.port}`
  )
})
