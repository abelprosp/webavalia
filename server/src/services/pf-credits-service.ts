import { pool } from '../db/pool.js'
import {
  PF_EVALUATION_REWARD,
  PF_FREE_EVALUATIONS,
  PF_PUBLISH_REWARD,
} from '../constants/pf-credits.js'
import { EVALUATION_CREDIT_COST } from '../constants/pricing.js'
import { PF_DAILY_EVALUATION_CAP } from '../constants/feature-flags.js'
import {
  addCredits,
  consumeCredits,
  InsufficientCreditsError,
} from './credits-service.js'

type PfCreditRewardType = 'pf_evaluation_reward' | 'pf_publish_reward'

export class PfDailyCapError extends Error {
  code = 'PF_DAILY_CAP' as const
  constructor(message = 'Limite diário de avaliações atingido. Tente amanhã.') {
    super(message)
    this.name = 'PfDailyCapError'
  }
}

export class PfInsufficientCreditsError extends InsufficientCreditsError {
  constructor(balance = 0) {
    super(
      `Você já usou suas ${PF_FREE_EVALUATIONS} avaliações grátis. É necessário ${EVALUATION_CREDIT_COST} créditos para continuar.`,
      EVALUATION_CREDIT_COST,
      balance
    )
    this.name = 'PfInsufficientCreditsError'
  }
}

/** @deprecated Caps mensais removidos — use PfInsufficientCreditsError. */
export class PfMonthlyCapError extends PfInsufficientCreditsError {
  constructor() {
    super()
    this.name = 'PfMonthlyCapError'
  }
}

/** @deprecated Publicações PF são ilimitadas. */
export class PfPublishCapError extends Error {
  code = 'PF_PUBLISH_CAP' as const
  constructor(
    message = 'Publicação disponível. O plano gratuito permite anunciar sem limites.'
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

async function countPfLifetimeEvaluations(userId: string) {
  const usage = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM property_evaluations
     WHERE user_id = $1`,
    [userId]
  )
  return Number(usage.rows[0]?.count ?? 0)
}

async function assertPfDailyCap(userId: string) {
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
}

/**
 * Registra uso de avaliação PF:
 * - 3 primeiras (lifetime) grátis
 * - a partir da 4ª: débito atômico de EVALUATION_CREDIT_COST
 * - teto diário de segurança
 */
export async function recordPfEvaluationUsage(userId: string) {
  await assertPfDailyCap(userId)

  const usedLifetime = await countPfLifetimeEvaluations(userId)

  if (usedLifetime < PF_FREE_EVALUATIONS) {
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

    return {
      credits: updated.rows[0].credits,
      chargedCredits: 0,
      freeEvaluationsRemaining: PF_FREE_EVALUATIONS - usedLifetime - 1,
    }
  }

  try {
    const credits = await consumeCredits({
      userId,
      amount: EVALUATION_CREDIT_COST,
      type: 'evaluation',
      description: `Avaliação IA PF — após ${PF_FREE_EVALUATIONS} grátis`,
    })
    return {
      credits,
      chargedCredits: EVALUATION_CREDIT_COST,
      freeEvaluationsRemaining: 0,
    }
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      throw new PfInsufficientCreditsError(error.balance)
    }
    throw error
  }
}

/** Reverte contagem/créditos de avaliação PF quando a IA falha. */
export async function revertPfEvaluationUsage(
  userId: string,
  chargedCredits = 0
) {
  if (chargedCredits > 0) {
    await pool.query(
      `UPDATE users
       SET credits = credits + $2,
           evaluations_used = GREATEST(evaluations_used - 1, 0),
           updated_at = NOW()
       WHERE id = $1`,
      [userId, chargedCredits]
    )
    await pool.query(
      `INSERT INTO credit_transactions (user_id, amount, type, description)
       VALUES ($1, $2, 'evaluation_refund', $3)`,
      [
        userId,
        chargedCredits,
        `Estorno de avaliação PF com falha (${chargedCredits} créditos)`,
      ]
    )
    return
  }

  await pool.query(
    `UPDATE users
     SET evaluations_used = GREATEST(evaluations_used - 1, 0),
         updated_at = NOW()
     WHERE id = $1`,
    [userId]
  )
}

/**
 * PF free pode anunciar/criar quantos imóveis quiser — sem limite de publicação.
 * Mantido para compatibilidade de chamadas existentes.
 */
export async function assertPfCanPublish(
  _userId: string,
  _evaluationId?: string
) {
  return
}
