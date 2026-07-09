import { pool } from '../db/pool.js'

export class CreditsExhaustedError extends Error {
  constructor() {
    super('Você não tem créditos suficientes. Compre créditos para continuar.')
    this.name = 'CreditsExhaustedError'
  }
}

/** @deprecated Use CreditsExhaustedError */
export class TrialExhaustedError extends CreditsExhaustedError {
  constructor() {
    super()
    this.name = 'TrialExhaustedError'
  }
}

export async function getCreditsRemaining(userId: string) {
  const result = await pool.query<{ credits: number }>(
    'SELECT credits FROM users WHERE id = $1',
    [userId]
  )

  if (!result.rowCount) {
    throw new Error('Usuário não encontrado.')
  }

  return result.rows[0].credits
}

/** @deprecated Use getCreditsRemaining */
export async function getTrialEvaluationsRemaining(userId: string) {
  return getCreditsRemaining(userId)
}

export async function reserveCreditForEvaluation(userId: string) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const locked = await client.query<{ credits: number }>(
      'SELECT credits FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    )

    if (!locked.rowCount) {
      throw new Error('Usuário não encontrado.')
    }

    if (locked.rows[0].credits <= 0) {
      throw new CreditsExhaustedError()
    }

    const updated = await client.query<{ credits: number }>(
      `UPDATE users
       SET credits = credits - 1,
           evaluations_used = evaluations_used + 1,
           updated_at = NOW()
       WHERE id = $1
       RETURNING credits`,
      [userId]
    )

    await client.query(
      `INSERT INTO credit_transactions (user_id, amount, type, description)
       VALUES ($1, -1, 'evaluation', 'Avaliação de imóvel com IA')`,
      [userId]
    )

    await client.query('COMMIT')
    return updated.rows[0].credits
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/** @deprecated Use reserveCreditForEvaluation */
export async function reserveTrialEvaluation(userId: string) {
  return reserveCreditForEvaluation(userId)
}

export async function refundCreditForEvaluation(userId: string) {
  await pool.query(
    `UPDATE users
     SET credits = credits + 1,
         evaluations_used = GREATEST(evaluations_used - 1, 0),
         updated_at = NOW()
     WHERE id = $1`,
    [userId]
  )

  await pool.query(
    `INSERT INTO credit_transactions (user_id, amount, type, description)
     VALUES ($1, 1, 'evaluation_refund', 'Estorno de avaliação com falha')`,
    [userId]
  )
}

/** @deprecated Use refundCreditForEvaluation */
export async function refundTrialEvaluation(userId: string) {
  return refundCreditForEvaluation(userId)
}
