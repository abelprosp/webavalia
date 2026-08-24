import { EVALUATION_CREDIT_COST } from '../constants/pricing.js'
import {
  consumeCredits,
  getCredits,
  InsufficientCreditsError,
} from './credits-service.js'
import { pool } from '../db/pool.js'

export class CreditsExhaustedError extends InsufficientCreditsError {
  constructor(required = EVALUATION_CREDIT_COST, balance = 0) {
    super(
      `Você não tem créditos suficientes. É necessário ${required} crédito(s) para avaliar.`,
      required,
      balance
    )
    this.name = 'CreditsExhaustedError'
  }
}

/** @deprecated Use CreditsExhaustedError */
export class TrialExhaustedError extends CreditsExhaustedError {
  constructor(required = EVALUATION_CREDIT_COST, balance = 0) {
    super(required, balance)
    this.name = 'TrialExhaustedError'
  }
}

export async function getCreditsRemaining(userId: string) {
  return getCredits(userId)
}

/** @deprecated Use getCreditsRemaining */
export async function getTrialEvaluationsRemaining(userId: string) {
  return getCreditsRemaining(userId)
}

export async function reserveCreditForEvaluation(userId: string) {
  try {
    return await consumeCredits({
      userId,
      amount: EVALUATION_CREDIT_COST,
      type: 'evaluation',
      description: `Avaliação de imóvel com IA (${EVALUATION_CREDIT_COST} créditos)`,
    })
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      throw new CreditsExhaustedError(error.required, error.balance)
    }
    throw error
  }
}

/** @deprecated Use reserveCreditForEvaluation */
export async function reserveTrialEvaluation(userId: string) {
  return reserveCreditForEvaluation(userId)
}

export async function refundCreditForEvaluation(userId: string) {
  await pool.query(
    `UPDATE users
     SET credits = credits + $2,
         evaluations_used = GREATEST(evaluations_used - 1, 0),
         updated_at = NOW()
     WHERE id = $1`,
    [userId, EVALUATION_CREDIT_COST]
  )

  await pool.query(
    `INSERT INTO credit_transactions (user_id, amount, type, description)
     VALUES ($1, $2, 'evaluation_refund', $3)`,
    [
      userId,
      EVALUATION_CREDIT_COST,
      `Estorno de avaliação com falha (${EVALUATION_CREDIT_COST} créditos)`,
    ]
  )
}

/** @deprecated Use refundCreditForEvaluation */
export async function refundTrialEvaluation(userId: string) {
  return refundCreditForEvaluation(userId)
}
