import { api } from './api'

export type Notification = {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  metadata: Record<string, unknown>
  readAt: string | null
  createdAt: string
}

export async function fetchNotifications() {
  const { data } = await api.get<{
    notifications: Notification[]
    unreadCount: number
  }>('/notifications')
  return data
}

export async function markNotificationRead(notificationId: string) {
  const { data } = await api.patch<{
    notification: Notification
    unreadCount: number
  }>(`/notifications/${notificationId}/read`)
  return data
}

export async function markAllNotificationsRead() {
  await api.patch('/notifications/read-all')
}
