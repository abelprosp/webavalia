import path from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
import cors from 'cors'
import { config } from './config.js'
import authRoutes from './routes/auth.js'
import adminRoutes from './routes/admin.js'
import plansRoutes from './routes/plans.js'
import evaluationRoutes from './routes/evaluation.js'
import paymentRoutes from './routes/payments.js'
import { abacatePayWebhookHandler } from './routes/payment-webhook.js'

const app = express()
const __dirname = path.dirname(fileURLToPath(import.meta.url))

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('X-XSS-Protection', '0')
  next()
})

app.use(cors({ origin: config.corsOrigin, credentials: true }))

app.post(
  '/api/payments/webhooks/abacatepay',
  express.raw({ type: 'application/json' }),
  abacatePayWebhookHandler
)

app.use(express.json({ limit: '15mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/plans', plansRoutes)
app.use('/api/evaluation', evaluationRoutes)
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
