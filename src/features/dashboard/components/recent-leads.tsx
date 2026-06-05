import { Link } from '@tanstack/react-router'
import { Inbox, Lock, MapPin } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { leads, maskContact } from '@/features/leads/data/leads'
import { useLeadsStore } from '@/stores/leads-store'

export function RecentLeads() {
  const isUnlocked = useLeadsStore((s) => s.isUnlocked)
  const recentLeads = [...leads]
    .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime())
    .slice(0, 5)

  if (recentLeads.length === 0) {
    return (
      <div className='flex flex-col items-center gap-3 py-8 text-center'>
        <Inbox className='size-8 text-muted-foreground' />
        <p className='text-sm text-muted-foreground'>
          Nenhum lead captado pelo WhatsApp ainda.
        </p>
        <Button variant='outline' size='sm' asChild>
          <Link to='/leads'>Ver leads</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      {recentLeads.map((lead) => {
        const unlocked = isUnlocked(lead.id)
        const initials = lead.name
          .split(' ')
          .map((n) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase()

        return (
          <div key={lead.id} className='flex items-center gap-4'>
            <Avatar className='size-9'>
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className='flex-1 space-y-1'>
              <p className='text-sm leading-none font-medium'>
                {unlocked ? lead.name : maskContact(lead.name)}
              </p>
              <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                <MapPin className='size-3' />
                {lead.location}
              </div>
            </div>
            <div className='flex items-center gap-2'>
              <Badge variant='outline'>{lead.interest}</Badge>
              {!unlocked && (
                <Button variant='ghost' size='icon' className='size-8' asChild>
                  <Link to='/leads'>
                    <Lock className='size-3' />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
