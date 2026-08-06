import { Link } from '@tanstack/react-router'
import { Coins } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useCreditsStore } from '@/stores/credits-store'

export function CreditsBadge() {
  const credits = useCreditsStore((s) => s.credits)

  return (
    <Link
      to='/settings/credits'
      className='transition-opacity hover:opacity-80'
      aria-label={`${credits} créditos disponíveis — ir para créditos e planos`}
    >
      <Badge variant='secondary' className='cursor-pointer gap-1.5 px-3 py-1.5 font-medium'>
        <Coins className='size-3.5' />
        {credits} {credits === 1 ? 'crédito' : 'créditos'}
      </Badge>
    </Link>
  )
}
