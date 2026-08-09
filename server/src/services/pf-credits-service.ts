import { pool } from '../db/pool.js'
import {
  PF_EVALUATION_REWARD,
  PF_PUBLISH_REWARD,
} from '../constants/pf-credits.js'
import { PF_DAILY_EVALUATION_CAP } from '../constants/feature-flags.js'
import { addCredits } from './credits-service.js'

type PfCreditRewardType = 'pf_evaluation_reward' | 'pf_publish_reward'

export class PfDailyCapError extends Error {
  constructor(message = 'Limite diário de avaliações atingido. Tente amanhã.') {
    super(message)
    this.name = 'PfDailyCapError'
  }
}

function rewardDescription(evaluationId: string) {
  return `evaluation:${evaluationId}`
}

async function hasRewardBeenGranted(
  userId: string,
  type: PfCreditRewardType,
  evaluationId: string
) {
  const result = await pool.query(
    `SELECT id FROM credit_transactions
     WHERE user_id = $1 AND type = $2 AND description = $3
     LIMIT 1`,
    [userId, type, rewardDescription(evaluationId)]
  )
  return Boolean(result.rowCount)
}

async function grantPfReward(input: {
  userId: string
  evaluationId: string
  type: PfCreditRewardType
  amount: number
}) {
  const alreadyGranted = await hasRewardBeenGranted(
    input.userId,
    input.type,
    input.evaluationId
  )

  if (alreadyGranted) {
    const credits = await pool.query<{ credits: number }>(
      'SELECT credits FROM users WHERE id = $1',
      [input.userId]
    )
    return { amount: 0, credits: credits.rows[0]?.credits ?? 0 }
  }

  const credits = await addCredits(
    input.userId,
    input.amount,
    input.type,
    rewardDescription(input.evaluationId)
  )

  return { amount: input.amount, credits }
}

export async function grantPfEvaluationReward(
  userId: string,
  evaluationId: string
) {
  return grantPfReward({
    userId,
    evaluationId,
    type: 'pf_evaluation_reward',
    amount: PF_EVALUATION_REWARD,
  })
}

export async function grantPfPublishReward(userId: string, evaluationId: string) {
  return grantPfReward({
    userId,
    evaluationId,
    type: 'pf_publish_reward',
    amount: PF_PUBLISH_REWARD,
  })
}

/** Registra uso de avaliação para PF com teto diário anti-abuso. */
export async function recordPfEvaluationUsage(userId: string) {
  const usage = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM property_evaluations
     WHERE user_id = $1
       AND created_at >= date_trunc('day', NOW() AT TIME ZONE 'America/Sao_Paulo')
         AT TIME ZONE 'America/Sao_Paulo'`,
    [userId]
  )

  const usedToday = Number(usage.rows[0]?.count ?? 0)
  if (usedToday >= PF_DAILY_EVALUATION_CAP) {
    throw new PfDailyCapError(
      `Limite diário de ${PF_DAILY_EVALUATION_CAP} avaliações atingido. Tente novamente amanhã.`
    )
  }

  const updated = await pool.query<{ credits: number }>(
    `UPDATE users
     SET evaluations_used = evaluations_used + 1,
         updated_at = NOW()
     WHERE id = $1
     RETURNING credits`,
    [userId]
  )

  if (!updated.rowCount) {
    throw new Error('Usuário não encontrado.')
  }

  return updated.rows[0].credits
}

/** Reverte contagem de avaliação PF quando a IA falha. */
export async function revertPfEvaluationUsage(userId: string) {
  await pool.query(
    `UPDATE users
     SET evaluations_used = GREATEST(evaluations_used - 1, 0),
         updated_at = NOW()
     WHERE id = $1`,
    [userId]
  )
}
