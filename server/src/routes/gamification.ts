import { Router } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { getGamificationStats, processEvaluationGamification } from '../services/gamification-service.js'

const router = Router()

router.get('/stats', requireAuth, async (req: AuthRequest, res) => {
  try {
    await processEvaluationGamification(req.user!.id)
    const stats = await getGamificationStats(req.user!.id)
    return res.json(stats)
  } catch (error) {
    console.error('Erro ao buscar gamificação:', error)
    return res.status(500).json({ message: 'Erro ao carregar progresso.' })
  }
})

export default router
