import { pool } from '../db/pool.js'

export async function adjustLeadCredits(input: {
  userId: string
  amount: number
  type: string
  description?: string
  createdBy?: string
}) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const updated = await client.query<{ lead_credits: number }>(
      `UPDATE users
       SET lead_credits = GREATEST(lead_credits + $2, 0),
           updated_at = NOW()
       WHERE id = $1
       RETURNING lead_credits`,
      [input.userId, input.amount]
    )

    if (!updated.rowCount) {
      throw new Error('Usuário não encontrado.')
    }

    await client.query(
      `INSERT INTO credit_transactions (user_id, amount, type, description, created_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        input.userId,
        input.amount,
        input.type,
        input.description ?? null,
        input.createdBy ?? null,
      ]
    )

    await client.query('COMMIT')
    return updated.rows[0].lead_credits
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function setTrialEvaluations(
  userId: string,
  remaining: number,
  adminId?: string
) {
  const updated = await pool.query<{ trial_evaluations_remaining: number }>(
    `UPDATE users
     SET trial_evaluations_remaining = GREATEST($2, 0),
         updated_at = NOW()
     WHERE id = $1
     RETURNING trial_evaluations_remaining`,
    [userId, remaining]
  )

  if (!updated.rowCount) {
    throw new Error('Usuário não encontrado.')
  }

  await pool.query(
    `INSERT INTO credit_transactions (user_id, amount, type, description, created_by)
     VALUES ($1, $2, 'trial_adjustment', $3, $4)`,
    [
      userId,
      remaining,
      `Ajuste de avaliações trial para ${remaining}`,
      adminId ?? null,
    ]
  )

  return updated.rows[0].trial_evaluations_remaining
}

export async function addTrialEvaluations(
  userId: string,
  amount: number,
  description?: string
) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const updated = await client.query<{ trial_evaluations_remaining: number }>(
      `UPDATE users
       SET trial_evaluations_remaining = trial_evaluations_remaining + $2,
           updated_at = NOW()
       WHERE id = $1
       RETURNING trial_evaluations_remaining`,
      [userId, amount]
    )

    if (!updated.rowCount) {
      throw new Error('Usuário não encontrado.')
    }

    await client.query(
      `INSERT INTO credit_transactions (user_id, amount, type, description)
       VALUES ($1, $2, 'evaluation_purchase', $3)`,
      [userId, amount, description ?? `Compra de ${amount} avaliações IA`]
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
