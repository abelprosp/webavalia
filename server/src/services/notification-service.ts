import { pool } from '../db/pool.js'

export type NotificationRow = {
  id: string
  user_id: string
  type: string
  title: string
  body: string | null
  link: string | null
  metadata: Record<string, unknown>
  read_at: Date | string | null
  created_at: Date | string
}

function mapNotification(row: NotificationRow) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    metadata: row.metadata ?? {},
    readAt:
      row.read_at instanceof Date
        ? row.read_at.toISOString()
        : row.read_at,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : row.created_at,
  }
}

export async function createNotification(input: {
  userId: string
  type: string
  title: string
  body?: string
  link?: string
  metadata?: Record<string, unknown>
}) {
  const result = await pool.query<NotificationRow>(
    `INSERT INTO user_notifications (user_id, type, title, body, link, metadata)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     RETURNING *`,
    [
      input.userId,
      input.type,
      input.title,
      input.body ?? null,
      input.link ?? null,
      JSON.stringify(input.metadata ?? {}),
    ]
  )

  return mapNotification(result.rows[0])
}

export async function listNotifications(userId: string, limit = 30) {
  const result = await pool.query<NotificationRow>(
    `SELECT * FROM user_notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  )

  return result.rows.map(mapNotification)
}

export async function getUnreadCount(userId: string) {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM user_notifications
     WHERE user_id = $1 AND read_at IS NULL`,
    [userId]
  )

  return Number(result.rows[0]?.count ?? 0)
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const result = await pool.query<NotificationRow>(
    `UPDATE user_notifications
     SET read_at = COALESCE(read_at, NOW())
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [notificationId, userId]
  )

  if (!result.rowCount) {
    throw new Error('Notificação não encontrada.')
  }

  return mapNotification(result.rows[0])
}

export async function markAllNotificationsRead(userId: string) {
  await pool.query(
    `UPDATE user_notifications
     SET read_at = NOW()
     WHERE user_id = $1 AND read_at IS NULL`,
    [userId]
  )
}
