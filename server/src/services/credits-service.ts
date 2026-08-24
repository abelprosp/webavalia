import { pool } from '../db/pool.js'

export class InsufficientCreditsError extends Error {
  code = 'INSUFFICIENT_CREDITS' as const
  constructor(
    message = 'Créditos insuficientes.',
    public readonly required = 0,
    public readonly balance = 0
  ) {
    super(message)
    this.name = 'InsufficientCreditsError'
  }
}

export async function getCredits(userId: string) {
  const result = await pool.query<{ credits: number }>(
    'SELECT credits FROM users WHERE id = $1',
    [userId]
  )
  if (!result.rowCount) throw new Error('Usuário não encontrado.')
  return result.rows[0].credits
}

/**
 * Débito atômico por userId. Saldo nunca fica negativo.
 * Usa FOR UPDATE + WHERE credits >= amount.
 */
export async function consumeCredits(input: {
  userId: string
  amount: number
  type: string
  description?: string
}) {
  if (input.amount <= 0) {
    return getCredits(input.userId)
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const locked = await client.query<{ credits: number }>(
      'SELECT credits FROM users WHERE id = $1 FOR UPDATE',
      [input.userId]
    )

    if (!locked.rowCount) {
      throw new Error('Usuário não encontrado.')
    }

    const balance = locked.rows[0].credits
    if (balance < input.amount) {
      throw new InsufficientCreditsError(
        `Créditos insuficientes. Necessário ${input.amount}, saldo ${balance}.`,
        input.amount,
        balance
      )
    }

    const updated = await client.query<{ credits: number }>(
      `UPDATE users
       SET credits = credits - $2,
           evaluations_used = evaluations_used + 1,
           updated_at = NOW()
       WHERE id = $1 AND credits >= $2
       RETURNING credits`,
      [input.userId, input.amount]
    )

    if (!updated.rowCount) {
      throw new InsufficientCreditsError(
        `Créditos insuficientes. Necessário ${input.amount}.`,
        input.amount,
        balance
      )
    }

    await client.query(
      `INSERT INTO credit_transactions (user_id, amount, type, description)
       VALUES ($1, $2, $3, $4)`,
      [
        input.userId,
        -input.amount,
        input.type,
        input.description ?? `Consumo de ${input.amount} crédito(s)`,
      ]
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

/** Ajuste relativo (+/-). Usado por admin, compras e recompensas. */
export async function adjustCredits(input: {
  userId: string
  amount: number
  type: string
  description?: string
  createdBy?: string
}) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const updated = await client.query<{ credits: number }>(
      `UPDATE users
       SET credits = GREATEST(credits + $2, 0),
           updated_at = NOW()
       WHERE id = $1
       RETURNING credits`,
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
    return updated.rows[0].credits
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/** Define o saldo absoluto (admin). */
export async function setCredits(
  userId: string,
  amount: number,
  adminId?: string
) {
  const updated = await pool.query<{ credits: number }>(
    `UPDATE users
     SET credits = GREATEST($2, 0),
         updated_at = NOW()
     WHERE id = $1
     RETURNING credits`,
    [userId, amount]
  )

  if (!updated.rowCount) {
    throw new Error('Usuário não encontrado.')
  }

  await pool.query(
    `INSERT INTO credit_transactions (user_id, amount, type, description, created_by)
     VALUES ($1, $2, 'admin_adjustment', $3, $4)`,
    [
      userId,
      amount,
      `Ajuste de créditos para ${amount}`,
      adminId ?? null,
    ]
  )

  return updated.rows[0].credits
}

export async function addCredits(
  userId: string,
  amount: number,
  type: string,
  description?: string
) {
  return adjustCredits({
    userId,
    amount,
    type,
    description: description ?? `Adição de ${amount} crédito(s)`,
  })
}

/** @deprecated Use adjustCredits */
export async function adjustLeadCredits(input: {
  userId: string
  amount: number
  type: string
  description?: string
  createdBy?: string
}) {
  return adjustCredits(input)
}

/** @deprecated Use setCredits */
export async function setTrialEvaluations(
  userId: string,
  remaining: number,
  adminId?: string
) {
  return setCredits(userId, remaining, adminId)
}

/** @deprecated Use addCredits */
export async function addTrialEvaluations(
  userId: string,
  amount: number,
  description?: string
) {
  return addCredits(
    userId,
    amount,
    'purchase',
    description ?? `Compra de ${amount} crédito(s)`
  )
}
