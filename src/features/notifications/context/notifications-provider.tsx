import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { toast } from 'sonner'
import { useNavigate } from '@tanstack/react-router'
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from '@/lib/notifications-api'

type NotificationsContextValue = {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  refresh: () => Promise<void>
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
}

const NotificationsContext = createContext<NotificationsContextValue | null>(
  null
)

export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const knownIdsRef = useRef<Set<string>>(new Set())
  const initializedRef = useRef(false)

  const refresh = useCallback(async () => {
    try {
      const data = await fetchNotifications()
      setNotifications(data.notifications)
      setUnreadCount(data.unreadCount)

      if (!initializedRef.current) {
        data.notifications.forEach((n) => knownIdsRef.current.add(n.id))
        initializedRef.current = true
        return
      }

      for (const notification of data.notifications) {
        if (knownIdsRef.current.has(notification.id)) continue
        knownIdsRef.current.add(notification.id)

        if (!notification.readAt) {
          const jobId =
            typeof notification.metadata?.jobId === 'string'
              ? notification.metadata.jobId
              : undefined

          toast.success(notification.title, {
            description: notification.body ?? undefined,
            duration: 8000,
            action:
              jobId || notification.link
                ? {
                    label: 'Ver',
                    onClick: () => {
                      if (jobId) {
                        navigate({
                          to: '/avaliacao',
                          search: { job: jobId },
                        })
                      } else if (notification.link) {
                        navigate({ to: notification.link })
                      }
                    },
                  }
                : undefined,
          })
        }
      }
    } catch {
      // silencioso — usuário pode estar deslogando
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    void refresh()
    const interval = setInterval(() => {
      void refresh()
    }, 15000)

    return () => clearInterval(interval)
  }, [refresh])

  const markRead = useCallback(async (id: string) => {
    const data = await markNotificationRead(id)
    setNotifications((current) =>
      current.map((n) => (n.id === id ? data.notification : n))
    )
    setUnreadCount(data.unreadCount)
  }, [])

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead()
    setNotifications((current) =>
      current.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }))
    )
    setUnreadCount(0)
  }, [])

  return (
    <NotificationsContext
      value={{
        notifications,
        unreadCount,
        loading,
        refresh,
        markRead,
        markAllRead,
      }}
    >
      {children}
    </NotificationsContext>
  )
}

export function useNotifications() {
  const context = useContext(NotificationsContext)
  if (!context) {
    throw new Error('useNotifications must be used within NotificationsProvider')
  }
  return context
}
