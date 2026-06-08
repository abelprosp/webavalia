import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Inbox, Lock, MapPin, Loader2 } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { fetchLeads, type LeadItem } from '@/lib/leads-api'

export function RecentLeads() {
  const [leads, setLeads] = useState<LeadItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLeads()
      .then((data) => setLeads(data.slice(0, 5)))
      .catch(() => setLeads([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className='flex items-center justify-center gap-2 py-8 text-muted-foreground'>
        <Loader2 className='size-4 animate-spin' />
        <span className='text-sm'>Carregando...</span>
      </div>
    )
  }

  if (leads.length === 0) {
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
      {leads.map((lead) => {
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
              <p className='text-sm leading-none font-medium'>{lead.name}</p>
              <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                <MapPin className='size-3' />
                {lead.location}
              </div>
            </div>
            <div className='flex items-center gap-2'>
              <Badge variant='outline'>{lead.interest}</Badge>
              {!lead.unlocked && (
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
