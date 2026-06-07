import { pool } from '../db/pool.js'
import { TRIAL_EVALUATIONS_TOTAL } from '../utils/password-policy.js'

export class TrialExhaustedError extends Error {
  constructor() {
    super('Suas 3 avaliações grátis de teste foram utilizadas.')
    this.name = 'TrialExhaustedError'
  }
}

export async function getTrialEvaluationsRemaining(userId: string) {
  const result = await pool.query<{ trial_evaluations_remaining: number }>(
    'SELECT trial_evaluations_remaining FROM users WHERE id = $1',
    [userId]
  )

  if (!result.rowCount) {
    throw new Error('Usuário não encontrado.')
  }

  return result.rows[0].trial_evaluations_remaining
}

export async function reserveTrialEvaluation(userId: string) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const locked = await client.query<{ trial_evaluations_remaining: number }>(
      'SELECT trial_evaluations_remaining FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    )

    if (!locked.rowCount) {
      throw new Error('Usuário não encontrado.')
    }

    const remaining = locked.rows[0].trial_evaluations_remaining
    if (remaining <= 0) {
      throw new TrialExhaustedError()
    }

    const updated = await client.query<{ trial_evaluations_remaining: number }>(
      `UPDATE users
       SET trial_evaluations_remaining = trial_evaluations_remaining - 1,
           evaluations_used = evaluations_used + 1,
           updated_at = NOW()
       WHERE id = $1
       RETURNING trial_evaluations_remaining`,
      [userId]
    )

    await client.query('COMMIT')
    return updated.rows[0].trial_evaluations_remaining
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function refundTrialEvaluation(userId: string) {
  await pool.query(
    `UPDATE users
     SET trial_evaluations_remaining = LEAST(trial_evaluations_remaining + 1, $2),
         evaluations_used = GREATEST(evaluations_used - 1, 0),
         updated_at = NOW()
     WHERE id = $1`,
    [userId, TRIAL_EVALUATIONS_TOTAL]
  )
}
