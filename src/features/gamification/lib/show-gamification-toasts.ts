import { toast } from 'sonner'
import type { Achievement, GamificationPayload } from '@/lib/gamification-api'
import { useAuthStore } from '@/stores/auth-store'

export function showNewAchievements(achievements: Achievement[]) {
  for (const achievement of achievements) {
    const rewardText =
      achievement.rewardEvaluations > 0
        ? ` +${achievement.rewardEvaluations} avaliação(ões) bônus`
        : ''

    toast.success(`Conquista: ${achievement.title}`, {
      description: `${achievement.description}${rewardText}`,
      duration: 6000,
    })
  }
}

export function showGamificationUpdates(payload: GamificationPayload | undefined) {
  if (!payload) return

  if (payload.trialEvaluationsRemaining != null) {
    useAuthStore
      .getState()
      .auth.updateTrialEvaluationsRemaining(payload.trialEvaluationsRemaining)
  }

  if (payload.newAchievements.length > 0) {
    showNewAchievements(payload.newAchievements)
  }

  if (
    payload.achievementTrialReward &&
    payload.achievementTrialReward > 0 &&
    payload.newAchievements.length > 1
  ) {
    toast.success(
      `Total de +${payload.achievementTrialReward} avaliações por conquistas!`,
      { duration: 5000 }
    )
  }

  if (payload.monthlyGoalCompleted) {
    toast.success('Meta mensal atingida!', {
      description: 'Parabéns — você bateu sua meta de avaliações deste mês.',
      duration: 6000,
    })
  }
}
