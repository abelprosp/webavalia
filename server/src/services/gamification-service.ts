import { pool } from '../db/pool.js'
import { getSetting } from './settings-service.js'
import { addTrialEvaluations } from './credits-service.js'

export type AchievementKey =
  | 'first_evaluation'
  | 'evaluations_5'
  | 'evaluations_10'
  | 'first_feedback'
  | 'feedback_5'
  | 'monthly_goal'
  | 'streak_3'

export type AchievementDefinition = {
  key: AchievementKey
  title: string
  description: string
  rewardEvaluations: number
}

/** Textos canônicos (PJ / corretor). PF sobrescreve só o display via localize*. */
export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    key: 'first_evaluation',
    title: 'Primeira avaliação',
    description: 'Realizou sua primeira avaliação com IA',
    rewardEvaluations: 0,
  },
  {
    key: 'evaluations_5',
    title: 'Corretor em ação',
    description: 'Completou 5 avaliações de imóveis',
    rewardEvaluations: 0,
  },
  {
    key: 'evaluations_10',
    title: 'Analista imobiliário',
    description: 'Completou 10 avaliações de imóveis',
    rewardEvaluations: 0,
  },
  {
    key: 'first_feedback',
    title: 'Mentor da IA',
    description: 'Enviou o primeiro feedback para calibrar a IA',
    rewardEvaluations: 1,
  },
  {
    key: 'feedback_5',
    title: 'Treinador expert',
    description: 'Enviou 5 feedbacks úteis para a IA',
    rewardEvaluations: 0,
  },
  {
    key: 'monthly_goal',
    title: 'Meta do mês',
    description: 'Atingiu a meta mensal de avaliações',
    rewardEvaluations: 0,
  },
  {
    key: 'streak_3',
    title: 'Sequência de 3 dias',
    description: 'Avaliou imóveis 3 dias seguidos',
    rewardEvaluations: 0,
  },
]

/** Labels de exibição para pessoa física (keys estáveis). */
const ACHIEVEMENT_COPY_PF: Partial<
  Record<AchievementKey, Pick<AchievementDefinition, 'title' | 'description'>>
> = {
  evaluations_5: {
    title: 'Em ação',
    description: 'Completou 5 avaliações de imóveis',
  },
  evaluations_10: {
    title: 'Analista de imóveis',
    description: 'Completou 10 avaliações de imóveis',
  },
}

const LEVELS = [
  { level: 1, name: 'Iniciante', minEvaluations: 0 },
  { level: 2, name: 'Corretor ativo', minEvaluations: 6 },
  { level: 3, name: 'Especialista', minEvaluations: 21 },
  { level: 4, name: 'Expert', minEvaluations: 50 },
] as const

const LEVEL_NAME_PF: Partial<Record<number, string>> = {
  2: 'Avaliador ativo',
}

function localizeAchievement(
  def: AchievementDefinition,
  accountType: string
): AchievementDefinition {
  if (accountType !== 'pf') return def
  const pf = ACHIEVEMENT_COPY_PF[def.key]
  if (!pf) return def
  return { ...def, title: pf.title, description: pf.description }
}

function localizeLevelName(
  level: number,
  name: string,
  accountType: string
): string {
  if (accountType !== 'pf') return name
  return LEVEL_NAME_PF[level] ?? name
}

async function getUserAccountType(userId: string): Promise<string> {
  const result = await pool.query<{ account_type: string }>(
    'SELECT account_type FROM users WHERE id = $1',
    [userId]
  )
  return result.rows[0]?.account_type ?? 'pf'
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
  achievements: Array<
    AchievementDefinition & {
      unlocked: boolean
      unlockedAt: string | null
    }
  >
  monthlyBreakdown: Record<string, number>
}

function getLevelInfo(
  evaluationsUsed: number,
  accountType: string = 'pj'
): LevelInfo {
  let currentIndex = 0
  for (let i = 0; i < LEVELS.length; i += 1) {
    if (evaluationsUsed >= LEVELS[i].minEvaluations) {
      currentIndex = i
    }
  }

  const current = LEVELS[currentIndex]
  const next = LEVELS[currentIndex + 1] ?? null
  const name = localizeLevelName(current.level, current.name, accountType)

  if (!next) {
    return {
      level: current.level,
      name,
      evaluationsUsed,
      progress: 1,
      nextLevelAt: null,
      evaluationsToNext: null,
    }
  }

  const span = next.minEvaluations - current.minEvaluations
  const progressInLevel = evaluationsUsed - current.minEvaluations

  return {
    level: current.level,
    name,
    evaluationsUsed,
    progress: Math.min(progressInLevel / span, 1),
    nextLevelAt: next.minEvaluations,
    evaluationsToNext: Math.max(next.minEvaluations - evaluationsUsed, 0),
  }
}

function toDayKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function computeStreak(evaluationDays: Date[]): { current: number; best: number } {
  if (evaluationDays.length === 0) {
    return { current: 0, best: 0 }
  }

  const uniqueDays = [...new Set(evaluationDays.map(toDayKey))].sort(
    (a, b) => b.localeCompare(a)
  )

  const todayKey = toDayKey(new Date())
  const yesterday = new Date()
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const yesterdayKey = toDayKey(yesterday)

  let current = 0
  if (uniqueDays[0] === todayKey || uniqueDays[0] === yesterdayKey) {
    let cursor = uniqueDays[0] === todayKey ? new Date() : yesterday
    for (const dayKey of uniqueDays) {
      if (dayKey !== toDayKey(cursor)) break
      current += 1
      cursor = new Date(cursor)
      cursor.setUTCDate(cursor.getUTCDate() - 1)
    }
  }

  let best = 0
  let run = 1
  for (let i = 1; i < uniqueDays.length; i += 1) {
    const prev = new Date(`${uniqueDays[i - 1]}T12:00:00Z`)
    const curr = new Date(`${uniqueDays[i]}T12:00:00Z`)
    const diffDays = Math.round(
      (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24)
    )
    if (diffDays === 1) {
      run += 1
    } else {
      best = Math.max(best, run)
      run = 1
    }
  }
  best = Math.max(best, run, current)

  return { current, best }
}

const MONTH_KEYS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
] as const

async function getUserMetrics(userId: string) {
  const [userResult, feedbackResult, evaluationDaysResult, monthlyResult] =
    await Promise.all([
      pool.query<{ evaluations_used: number }>(
        'SELECT evaluations_used FROM users WHERE id = $1',
        [userId]
      ),
      pool.query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM evaluation_feedback WHERE user_id = $1',
        [userId]
      ),
      pool.query<{ created_at: Date }>(
        `SELECT created_at FROM property_evaluations
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
      ),
      pool.query<{ month: number; count: string }>(
        `SELECT EXTRACT(MONTH FROM created_at)::int AS month, COUNT(*)::text AS count
         FROM property_evaluations
         WHERE user_id = $1
           AND created_at >= date_trunc('year', NOW())
         GROUP BY EXTRACT(MONTH FROM created_at)`,
        [userId]
      ),
    ])

  const evaluationsUsed = userResult.rows[0]?.evaluations_used ?? 0
  const feedbackCount = Number(feedbackResult.rows[0]?.count ?? 0)
  const evaluationDays = evaluationDaysResult.rows.map((r) => r.created_at)

  const monthlyBreakdown = Object.fromEntries(
    MONTH_KEYS.map((key) => [key, 0])
  ) as Record<string, number>

  for (const row of monthlyResult.rows) {
    const key = MONTH_KEYS[row.month - 1]
    if (key) monthlyBreakdown[key] = Number(row.count)
  }

  const currentMonthKey = MONTH_KEYS[new Date().getMonth()]
  const evaluationsThisMonth = monthlyBreakdown[currentMonthKey] ?? 0

  return {
    evaluationsUsed,
    feedbackCount,
    evaluationDays,
    evaluationsThisMonth,
    monthlyBreakdown,
  }
}

async function getUnlockedAchievements(userId: string) {
  const result = await pool.query<{ achievement_key: string; unlocked_at: Date }>(
    `SELECT achievement_key, unlocked_at FROM user_achievements WHERE user_id = $1`,
    [userId]
  )

  return new Map(
    result.rows.map((row) => [
      row.achievement_key,
      row.unlocked_at instanceof Date
        ? row.unlocked_at.toISOString()
        : String(row.unlocked_at),
    ])
  )
}

function resolveEligibleAchievements(metrics: {
  evaluationsUsed: number
  feedbackCount: number
  evaluationsThisMonth: number
  monthlyGoalTarget: number
  streakCurrent: number
}): AchievementKey[] {
  const eligible: AchievementKey[] = []

  if (metrics.evaluationsUsed >= 1) eligible.push('first_evaluation')
  if (metrics.evaluationsUsed >= 5) eligible.push('evaluations_5')
  if (metrics.evaluationsUsed >= 10) eligible.push('evaluations_10')
  if (metrics.feedbackCount >= 1) eligible.push('first_feedback')
  if (metrics.feedbackCount >= 5) eligible.push('feedback_5')
  if (metrics.evaluationsThisMonth >= metrics.monthlyGoalTarget) {
    eligible.push('monthly_goal')
  }
  if (metrics.streakCurrent >= 3) eligible.push('streak_3')

  return eligible
}

async function grantAchievementRewards(
  userId: string,
  keys: AchievementKey[],
  accountType: string
): Promise<{ totalReward: number; trialEvaluationsRemaining: number | null }> {
  const isBroker = accountType === 'pj'

  let totalReward = 0
  let trialEvaluationsRemaining: number | null = null

  for (const key of keys) {
    const def = ACHIEVEMENT_DEFINITIONS.find((a) => a.key === key)
    if (!def || def.rewardEvaluations <= 0) continue
    // PF recebe créditos pelo pf-credits-service, não por conquistas.
    if (!isBroker) continue

    const localized = localizeAchievement(def, accountType)
    trialEvaluationsRemaining = await addTrialEvaluations(
      userId,
      def.rewardEvaluations,
      `Conquista desbloqueada: ${localized.title}`
    )
    totalReward += def.rewardEvaluations
  }

  return { totalReward, trialEvaluationsRemaining }
}

async function unlockAchievements(
  userId: string,
  keys: AchievementKey[],
  alreadyUnlocked: Map<string, string>,
  accountType: string
) {
  const newlyUnlocked: AchievementKey[] = []

  for (const key of keys) {
    if (alreadyUnlocked.has(key)) continue

    const inserted = await pool.query<{ achievement_key: string }>(
      `INSERT INTO user_achievements (user_id, achievement_key)
       VALUES ($1, $2)
       ON CONFLICT (user_id, achievement_key) DO NOTHING
       RETURNING achievement_key`,
      [userId, key]
    )

    if (!inserted.rowCount) continue

    const unlockedAt = new Date().toISOString()
    alreadyUnlocked.set(key, unlockedAt)
    newlyUnlocked.push(key)
  }

  const { totalReward, trialEvaluationsRemaining } = await grantAchievementRewards(
    userId,
    newlyUnlocked,
    accountType
  )

  const achievements = newlyUnlocked.map((key) => {
    const def = localizeAchievement(
      ACHIEVEMENT_DEFINITIONS.find((a) => a.key === key)!,
      accountType
    )
    return {
      ...def,
      unlocked: true,
      unlockedAt: alreadyUnlocked.get(key) ?? new Date().toISOString(),
    }
  })

  return { achievements, totalReward, trialEvaluationsRemaining }
}

export async function getGamificationStats(
  userId: string
): Promise<GamificationStats> {
  const monthlyGoalTarget = await getSetting<number>(
    'gamification_monthly_goal',
    5
  )

  const [metrics, unlockedMap, accountType] = await Promise.all([
    getUserMetrics(userId),
    getUnlockedAchievements(userId),
    getUserAccountType(userId),
  ])
  const streak = computeStreak(metrics.evaluationDays)

  const achievements = ACHIEVEMENT_DEFINITIONS.map((def) => {
    const localized = localizeAchievement(def, accountType)
    return {
      ...localized,
      unlocked: unlockedMap.has(def.key),
      unlockedAt: unlockedMap.get(def.key) ?? null,
    }
  })

  return {
    evaluationsUsed: metrics.evaluationsUsed,
    feedbackCount: metrics.feedbackCount,
    level: getLevelInfo(metrics.evaluationsUsed, accountType),
    monthlyGoal: {
      target: monthlyGoalTarget,
      current: metrics.evaluationsThisMonth,
      completed: metrics.evaluationsThisMonth >= monthlyGoalTarget,
    },
    streak,
    achievements,
    monthlyBreakdown: metrics.monthlyBreakdown,
  }
}

export async function processEvaluationGamification(userId: string) {
  const monthlyGoalTarget = await getSetting<number>(
    'gamification_monthly_goal',
    5
  )

  const [metrics, unlockedMap, accountType] = await Promise.all([
    getUserMetrics(userId),
    getUnlockedAchievements(userId),
    getUserAccountType(userId),
  ])
  const streak = computeStreak(metrics.evaluationDays)

  const eligible = resolveEligibleAchievements({
    evaluationsUsed: metrics.evaluationsUsed,
    feedbackCount: metrics.feedbackCount,
    evaluationsThisMonth: metrics.evaluationsThisMonth,
    monthlyGoalTarget,
    streakCurrent: streak.current,
  })

  const { achievements: newAchievements, totalReward, trialEvaluationsRemaining } =
    await unlockAchievements(userId, eligible, unlockedMap, accountType)

  return {
    newAchievements,
    achievementTrialReward: totalReward,
    trialEvaluationsRemaining,
    level: getLevelInfo(metrics.evaluationsUsed, accountType),
    monthlyGoalCompleted: metrics.evaluationsThisMonth >= monthlyGoalTarget,
  }
}

export async function processFeedbackGamification(userId: string) {
  const feedbackRewardAmount = await getSetting<number>(
    'gamification_feedback_reward',
    0
  )

  const gamification = await processEvaluationGamification(userId)

  let trialEvaluationsRemaining = gamification.trialEvaluationsRemaining
  let feedbackTrialReward = 0

  if (feedbackRewardAmount > 0) {
    trialEvaluationsRemaining = await addTrialEvaluations(
      userId,
      feedbackRewardAmount,
      'Recompensa por feedback útil à IA'
    )
    feedbackTrialReward = feedbackRewardAmount
  }

  const totalTrialReward =
    gamification.achievementTrialReward + feedbackTrialReward

  return {
    ...gamification,
    trialEvaluationsRemaining,
    reward: {
      trialEvaluations: totalTrialReward,
      achievementTrialEvaluations: gamification.achievementTrialReward,
      feedbackTrialEvaluations: feedbackTrialReward,
      trialEvaluationsRemaining,
    },
  }
}

export function mapAchievementForResponse(
  achievement: AchievementDefinition & {
    unlocked?: boolean
    unlockedAt?: string | null
  }
) {
  return {
    key: achievement.key,
    title: achievement.title,
    description: achievement.description,
    rewardEvaluations: achievement.rewardEvaluations,
    unlocked: achievement.unlocked ?? true,
    unlockedAt: achievement.unlockedAt ?? new Date().toISOString(),
  }
}
