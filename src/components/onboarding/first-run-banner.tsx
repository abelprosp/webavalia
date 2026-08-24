import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Home, Sparkles, Users, X } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { isBrokerAccount } from '@/lib/auth-api'
import { Button } from '@/components/ui/button'

const STORAGE_KEY_PJ = 'avalia-onboarding-dismissed'
const STORAGE_KEY_PF = 'avalia-onboarding-pf-dismissed'

export function FirstRunBanner() {
  const user = useAuthStore((s) => s.auth.user)
  const isBroker = isBrokerAccount(user)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!user) return
    const key = isBroker ? STORAGE_KEY_PJ : STORAGE_KEY_PF
    const dismissed = localStorage.getItem(key)
    if (!dismissed) setVisible(true)
  }, [user, isBroker])

  if (!visible || !user) return null

  function dismiss() {
    localStorage.setItem(isBroker ? STORAGE_KEY_PJ : STORAGE_KEY_PF, '1')
    setVisible(false)
  }

  if (!isBroker) {
    return (
      <div className='mb-6 overflow-hidden rounded-[1.75rem] border border-flux-lavender/30 bg-gradient-to-br from-flux-lavender/10 via-background to-flux-lime/10 p-5'>
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div className='space-y-2'>
            <p className='flex items-center gap-2 text-sm font-semibold'>
              <Sparkles className='size-4 text-flux-lavender' />
              Primeiros passos na Avalia Imob
            </p>
            <p className='max-w-xl text-sm text-muted-foreground'>
              Avalie seu imóvel com IA, publique para captar interesse de
              corretores e acompanhe o resultado em Minhas avaliações.
            </p>
            <ol className='flex flex-wrap gap-2 pt-1 text-xs font-medium'>
              <li className='rounded-full bg-background px-3 py-1 shadow-sm'>
                1. Avaliar imóvel
              </li>
              <li className='rounded-full bg-background px-3 py-1 shadow-sm'>
                2. Publicar
              </li>
              <li className='rounded-full bg-background px-3 py-1 shadow-sm'>
                3. Acompanhar
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
              <Link to='/minhas-avaliacoes'>
                <Home className='size-4' />
                Minhas avaliações
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

  return (
    <div className='mb-6 overflow-hidden rounded-[1.75rem] border border-flux-lavender/30 bg-gradient-to-br from-flux-lavender/10 via-background to-flux-lime/10 p-5'>
      <div className='flex flex-wrap items-start justify-between gap-4'>
        <div className='space-y-2'>
          <p className='flex items-center gap-2 text-sm font-semibold'>
            <Sparkles className='size-4 text-flux-lavender' />
            Primeiros passos na Avalia Imob
          </p>
          <p className='max-w-xl text-sm text-muted-foreground'>
            Siga o funil: avalie um imóvel → desbloqueie oportunidades →
            gerencie no pipeline do CRM.
          </p>
          <ol className='flex flex-wrap gap-2 pt-1 text-xs font-medium'>
            <li className='rounded-full bg-background px-3 py-1 shadow-sm'>
              1. Avaliar imóvel
            </li>
            <li className='rounded-full bg-background px-3 py-1 shadow-sm'>
              2. Oportunidades
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
              Ver oportunidades
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
