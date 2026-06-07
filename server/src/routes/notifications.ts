import { Router } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notification-service.js'

const router = Router()

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const notifications = await listNotifications(req.user!.id)
    const unreadCount = await getUnreadCount(req.user!.id)
    return res.json({ notifications, unreadCount })
  } catch (error) {
    console.error('Erro ao listar notificações:', error)
    return res.status(500).json({ message: 'Erro ao carregar notificações.' })
  }
})

router.get('/unread-count', requireAuth, async (req: AuthRequest, res) => {
  try {
    const unreadCount = await getUnreadCount(req.user!.id)
    return res.json({ unreadCount })
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao carregar notificações.' })
  }
})

router.patch('/read-all', requireAuth, async (req: AuthRequest, res) => {
  try {
    await markAllNotificationsRead(req.user!.id)
    return res.json({ message: 'Notificações marcadas como lidas.' })
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao atualizar notificações.' })
  }
})

router.patch('/:id/read', requireAuth, async (req: AuthRequest, res) => {
  try {
    const notification = await markNotificationRead(
      req.user!.id,
      String(req.params.id)
    )
    const unreadCount = await getUnreadCount(req.user!.id)
    return res.json({ notification, unreadCount })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erro ao atualizar notificação.'
    return res.status(400).json({ message })
  }
})

export default router
