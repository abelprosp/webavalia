import { Router } from 'express'
import { pool } from '../db/pool.js'

const router = Router()

function mapPlan(row: {
  id: string
  name: string
  description: string | null
  price_cents: number
  lead_credits: number
  trial_evaluations: number
  is_active: boolean
  sort_order: number
}) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    leadCredits: row.lead_credits,
    trialEvaluations: row.trial_evaluations,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    priceLabel: (row.price_cents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }),
  }
}

router.get('/', async (_req, res) => {
  const result = await pool.query(
    'SELECT * FROM plans WHERE is_active = true ORDER BY sort_order ASC'
  )
  return res.json({ plans: result.rows.map(mapPlan) })
})

export default router
