import { toast } from 'sonner'
import type { Achievement, GamificationPayload } from '@/lib/gamification-api'

export function showNewAchievements(achievements: Achievement[]) {
  for (const achievement of achievements) {
    toast.success(`Conquista desbloqueada: ${achievement.title}`, {
      description: achievement.description,
      duration: 6000,
    })
  }
}

export function showGamificationUpdates(payload: GamificationPayload | undefined) {
  if (!payload) return

  if (payload.newAchievements.length > 0) {
    showNewAchievements(payload.newAchievements)
  }

  if (payload.monthlyGoalCompleted) {
    toast.success('Meta mensal atingida!', {
      description: 'Parabéns — você bateu sua meta de avaliações deste mês.',
      duration: 6000,
    })
  }
}
