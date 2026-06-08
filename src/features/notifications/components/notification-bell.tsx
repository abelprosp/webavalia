import { Bell, CheckCheck, Loader2 } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useNotifications } from '../context/notifications-provider'

function formatWhen(iso: string) {
  const date = new Date(iso)
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function NotificationBell() {
  const navigate = useNavigate()
  const { notifications, unreadCount, loading, markRead, markAllRead } =
    useNotifications()

  async function openNotification(id: string, link: string | null) {
    await markRead(id)
    if (link) navigate({ to: link })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='outline' size='icon' className='relative'>
          <Bell className='size-4' />
          {unreadCount > 0 && (
            <span className='absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground'>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
          <span className='sr-only'>Notificações</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-80'>
        <DropdownMenuLabel className='flex items-center justify-between gap-2'>
          <span>Notificações</span>
          {unreadCount > 0 && (
            <Button
              variant='ghost'
              size='sm'
              className='h-auto px-2 py-1 text-xs'
              onClick={() => void markAllRead()}
            >
              <CheckCheck className='me-1 size-3.5' />
              Marcar todas
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loading ? (
          <div className='flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground'>
            <Loader2 className='size-4 animate-spin' />
            Carregando...
          </div>
        ) : notifications.length === 0 ? (
          <div className='px-3 py-6 text-center text-sm text-muted-foreground'>
            Nenhuma notificação ainda.
          </div>
        ) : (
          notifications.slice(0, 12).map((notification) => (
            <DropdownMenuItem
              key={notification.id}
              className={cn(
                'flex cursor-pointer flex-col items-start gap-1 py-3',
                !notification.readAt && 'bg-primary/5'
              )}
              onClick={() =>
                void openNotification(notification.id, notification.link)
              }
            >
              <div className='flex w-full items-start justify-between gap-2'>
                <span className='font-medium'>{notification.title}</span>
                {!notification.readAt && (
                  <span className='mt-1 size-2 shrink-0 rounded-full bg-primary' />
                )}
              </div>
              {notification.body && (
                <span className='line-clamp-2 text-xs text-muted-foreground'>
                  {notification.body}
                </span>
              )}
              <span className='text-[10px] text-muted-foreground'>
                {formatWhen(notification.createdAt)}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
