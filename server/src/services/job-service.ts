import { pool } from '../db/pool.js'

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed'

export type BackgroundJobRow = {
  id: string
  user_id: string
  type: string
  status: JobStatus
  payload: Record<string, unknown>
  result: Record<string, unknown> | null
  error_message: string | null
  trial_evaluations_remaining: number | null
  created_at: Date | string
  started_at: Date | string | null
  completed_at: Date | string | null
}

function mapJob(row: BackgroundJobRow) {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    status: row.status,
    payload: row.payload,
    result: row.result,
    errorMessage: row.error_message,
    trialEvaluationsRemaining: row.trial_evaluations_remaining,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : row.created_at,
    startedAt:
      row.started_at instanceof Date
        ? row.started_at.toISOString()
        : row.started_at,
    completedAt:
      row.completed_at instanceof Date
        ? row.completed_at.toISOString()
        : row.completed_at,
  }
}

export async function createBackgroundJob(input: {
  userId: string
  type: string
  payload: Record<string, unknown>
  trialEvaluationsRemaining: number
}) {
  const result = await pool.query<BackgroundJobRow>(
    `INSERT INTO background_jobs (user_id, type, status, payload, trial_evaluations_remaining)
     VALUES ($1, $2, 'queued', $3::jsonb, $4)
     RETURNING *`,
    [
      input.userId,
      input.type,
      JSON.stringify(input.payload),
      input.trialEvaluationsRemaining,
    ]
  )

  return mapJob(result.rows[0])
}

export async function getBackgroundJob(jobId: string, userId?: string) {
  const result = await pool.query<BackgroundJobRow>(
    userId
      ? `SELECT * FROM background_jobs WHERE id = $1 AND user_id = $2`
      : `SELECT * FROM background_jobs WHERE id = $1`,
    userId ? [jobId, userId] : [jobId]
  )

  if (!result.rowCount) return null
  return mapJob(result.rows[0])
}

export async function markJobProcessing(jobId: string) {
  await pool.query(
    `UPDATE background_jobs
     SET status = 'processing', started_at = NOW()
     WHERE id = $1 AND status = 'queued'`,
    [jobId]
  )
}

export async function markJobCompleted(
  jobId: string,
  result: Record<string, unknown>,
  trialEvaluationsRemaining?: number | null
) {
  await pool.query(
    `UPDATE background_jobs
     SET status = 'completed',
         result = $2::jsonb,
         trial_evaluations_remaining = COALESCE($3, trial_evaluations_remaining),
         completed_at = NOW()
     WHERE id = $1`,
    [
      jobId,
      JSON.stringify(result),
      trialEvaluationsRemaining ?? null,
    ]
  )
}

export async function markJobFailed(jobId: string, errorMessage: string) {
  await pool.query(
    `UPDATE background_jobs
     SET status = 'failed', error_message = $2, completed_at = NOW()
     WHERE id = $1`,
    [jobId, errorMessage]
  )
}
