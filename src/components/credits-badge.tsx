import { Link } from '@tanstack/react-router'
import { Coins } from 'lucide-react'
import { useCreditsStore } from '@/stores/credits-store'
import { CREDITS_AND_PLANS_ENABLED } from '@/lib/feature-flags'
import { Badge } from '@/components/ui/badge'

export function CreditsBadge() {
  const credits = useCreditsStore((s) => s.credits)

  const content = (
    <Badge
      variant='secondary'
      className={`gap-1.5 px-3 py-1.5 font-medium ${CREDITS_AND_PLANS_ENABLED ? 'cursor-pointer' : ''}`}
    >
      <Coins className='size-3.5' />
      {credits} {credits === 1 ? 'crédito' : 'créditos'}
      {!CREDITS_AND_PLANS_ENABLED && (
        <span className='text-[10px] font-normal text-muted-foreground'>
          · em breve
        </span>
      )}
    </Badge>
  )

  if (!CREDITS_AND_PLANS_ENABLED) {
    return (
      <span
        aria-label={`${credits} créditos disponíveis. Compra de créditos em breve.`}
      >
        {content}
      </span>
    )
  }

  return (
    <Link
      to='/settings/credits'
      className='transition-opacity hover:opacity-80'
      aria-label={`${credits} créditos disponíveis — ir para créditos e planos`}
    >
      {content}
    </Link>
  )
}
