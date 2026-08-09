import { pool } from '../db/pool.js'
import {
  PF_EVALUATION_REWARD,
  PF_FREE_MONTHLY_EVALUATION_CAP,
  PF_FREE_MONTHLY_PUBLISH_CAP,
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

export class PfMonthlyCapError extends Error {
  code = 'PF_MONTHLY_CAP' as const
  constructor(
    message = `Limite gratuito de ${PF_FREE_MONTHLY_EVALUATION_CAP} avaliações/mês atingido. Assine o Proprietário Plus ou compre uma avaliação avulsa.`
  ) {
    super(message)
    this.name = 'PfMonthlyCapError'
  }
}

export class PfPublishCapError extends Error {
  code = 'PF_PUBLISH_CAP' as const
  constructor(
    message = `No plano gratuito você pode publicar ${PF_FREE_MONTHLY_PUBLISH_CAP} imóvel por mês. Assine o Proprietário Plus para publicar sem limites.`
  ) {
    super(message)
    this.name = 'PfPublishCapError'
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
  if (input.amount <= 0) {
    const credits = await pool.query<{ credits: number }>(
      'SELECT credits FROM users WHERE id = $1',
      [input.userId]
    )
    return { amount: 0, credits: credits.rows[0]?.credits ?? 0 }
  }

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

/** Bônus apenas na primeira publicação da conta (lifetime). */
export async function grantPfPublishReward(userId: string, evaluationId: string) {
  const prior = await pool.query(
    `SELECT id FROM credit_transactions
     WHERE user_id = $1 AND type = 'pf_publish_reward'
     LIMIT 1`,
    [userId]
  )
  if (prior.rowCount) {
    const credits = await pool.query<{ credits: number }>(
      'SELECT credits FROM users WHERE id = $1',
      [userId]
    )
    return { amount: 0, credits: credits.rows[0]?.credits ?? 0 }
  }

  return grantPfReward({
    userId,
    evaluationId,
    type: 'pf_publish_reward',
    amount: PF_PUBLISH_REWARD,
  })
}

async function countPfEvaluationsThisMonth(userId: string) {
  const usage = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM property_evaluations
     WHERE user_id = $1
       AND created_at >= date_trunc('month', NOW() AT TIME ZONE 'America/Sao_Paulo')
         AT TIME ZONE 'America/Sao_Paulo'`,
    [userId]
  )
  return Number(usage.rows[0]?.count ?? 0)
}

async function countPfPublishesThisMonth(userId: string) {
  const usage = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM leads
     WHERE raw_payload->>'ownerUserId' = $1
       AND created_at >= date_trunc('month', NOW() AT TIME ZONE 'America/Sao_Paulo')
         AT TIME ZONE 'America/Sao_Paulo'`,
    [userId]
  )
  return Number(usage.rows[0]?.count ?? 0)
}

async function hasActivePaidSubscription(userId: string) {
  const result = await pool.query<{ efi_subscription_id: string | null }>(
    `SELECT efi_subscription_id FROM users WHERE id = $1`,
    [userId]
  )
  return Boolean(result.rows[0]?.efi_subscription_id)
}

/** Registra uso de avaliação PF: cap mensal free + teto diário de segurança. */
export async function recordPfEvaluationUsage(userId: string) {
  const paid = await hasActivePaidSubscription(userId)

  if (!paid) {
    const usedMonth = await countPfEvaluationsThisMonth(userId)
    if (usedMonth >= PF_FREE_MONTHLY_EVALUATION_CAP) {
      throw new PfMonthlyCapError()
    }
  }

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

/** Garante limite de publicação no plano free (ignora republicação). */
export async function assertPfCanPublish(
  userId: string,
  evaluationId?: string
) {
  if (evaluationId) {
    const existing = await pool.query(
      `SELECT id FROM leads WHERE external_id = $1 LIMIT 1`,
      [`evaluation-${evaluationId}`]
    )
    if (existing.rowCount) return
  }

  const paid = await hasActivePaidSubscription(userId)
  if (paid) return

  const published = await countPfPublishesThisMonth(userId)
  if (published >= PF_FREE_MONTHLY_PUBLISH_CAP) {
    throw new PfPublishCapError()
  }
}
