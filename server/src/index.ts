import path from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
import cors from 'cors'
import { config } from './config.js'
import authRoutes from './routes/auth.js'
import evaluationRoutes from './routes/evaluation.js'

const app = express()
const __dirname = path.dirname(fileURLToPath(import.meta.url))

app.use(cors({ origin: config.corsOrigin, credentials: true }))
app.use(express.json({ limit: '15mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/auth', authRoutes)
app.use('/api/evaluation', evaluationRoutes)

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
