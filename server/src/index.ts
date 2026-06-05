import express from 'express'
import cors from 'cors'
import { config } from './config.js'
import authRoutes from './routes/auth.js'
import evaluationRoutes from './routes/evaluation.js'

const app = express()

app.use(cors({ origin: config.corsOrigin, credentials: true }))
app.use(express.json({ limit: '15mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/auth', authRoutes)
app.use('/api/evaluation', evaluationRoutes)

app.listen(config.port, () => {
  console.log(`API Avalia Imob rodando em http://localhost:${config.port}`)
})
