import { api } from './api'

export type Achievement = {
  key: string
  title: string
  description: string
  unlocked: boolean
  unlockedAt: string | null
}

export type LevelInfo = {
  level: number
  name: string
  evaluationsUsed: number
  progress: number
  nextLevelAt: number | null
  evaluationsToNext: number | null
}

export type GamificationStats = {
  evaluationsUsed: number
  feedbackCount: number
  level: LevelInfo
  monthlyGoal: {
    target: number
    current: number
    completed: boolean
  }
  streak: {
    current: number
    best: number
  }
  achievements: Achievement[]
  monthlyBreakdown: Record<string, number>
}

export type GamificationPayload = {
  level: LevelInfo
  monthlyGoalCompleted: boolean
  newAchievements: Achievement[]
}

export type FeedbackReward = {
  trialEvaluations: number
  trialEvaluationsRemaining: number | null
}

export async function fetchGamificationStats() {
  const { data } = await api.get<GamificationStats>('/gamification/stats')
  return data
}
