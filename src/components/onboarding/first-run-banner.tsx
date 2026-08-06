import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Sparkles, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isBrokerAccount } from '@/lib/auth-api'
import { useAuthStore } from '@/stores/auth-store'

const STORAGE_KEY = 'avalia-onboarding-dismissed'

export function FirstRunBanner() {
  const user = useAuthStore((s) => s.auth.user)
  const isBroker = isBrokerAccount(user)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!user || !isBroker) return
    const dismissed = localStorage.getItem(STORAGE_KEY)
    if (!dismissed) setVisible(true)
  }, [user, isBroker])

  if (!visible || !isBroker) return null

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  return (
    <div className='mb-6 overflow-hidden rounded-[1.75rem] border border-flux-lavender/30 bg-gradient-to-br from-flux-lavender/10 via-background to-flux-lime/10 p-5'>
      <div className='flex flex-wrap items-start justify-between gap-4'>
        <div className='space-y-2'>
          <p className='flex items-center gap-2 text-sm font-semibold'>
            <Sparkles className='size-4 text-flux-lavender' />
            Primeiros passos na Avalia Imob
          </p>
          <p className='max-w-xl text-sm text-muted-foreground'>
            Siga o funil: avalie um imóvel → publique para captar leads →
            desbloqueie oportunidades → gerencie no pipeline do CRM.
          </p>
          <ol className='flex flex-wrap gap-2 pt-1 text-xs font-medium'>
            <li className='rounded-full bg-background px-3 py-1 shadow-sm'>
              1. Avaliar imóvel
            </li>
            <li className='rounded-full bg-background px-3 py-1 shadow-sm'>
              2. Leads
            </li>
            <li className='rounded-full bg-background px-3 py-1 shadow-sm'>
              3. CRM
            </li>
          </ol>
        </div>
        <div className='flex shrink-0 items-center gap-2'>
          <Button size='sm' asChild>
            <Link to='/avaliacao'>
              Começar
              <ArrowRight className='size-4' />
            </Link>
          </Button>
          <Button size='sm' variant='outline' asChild>
            <Link to='/leads'>
              <Users className='size-4' />
              Ver leads
            </Link>
          </Button>
          <Button
            size='icon'
            variant='ghost'
            className='size-8'
            onClick={dismiss}
            aria-label='Fechar dicas de onboarding'
          >
            <X className='size-4' />
          </Button>
        </div>
      </div>
    </div>
  )
}
