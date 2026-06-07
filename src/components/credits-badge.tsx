import { Coins, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/stores/auth-store'
import { useCreditsStore } from '@/stores/credits-store'

export function CreditsBadge() {
  const credits = useCreditsStore((s) => s.credits)
  const trialRemaining = useAuthStore(
    (s) => s.auth.user?.trialEvaluationsRemaining
  )
  const trialTotal = useAuthStore((s) => s.auth.user?.trialEvaluationsTotal ?? 3)

  return (
    <div className='flex items-center gap-2'>
      {trialRemaining != null && (
        <Badge variant='secondary' className='gap-1.5 px-3 py-1.5 font-medium'>
          <Sparkles className='size-3.5' />
          {trialRemaining}/{trialTotal} avaliações
        </Badge>
      )}
      <Badge variant='secondary' className='gap-1.5 px-3 py-1.5 font-medium'>
        <Coins className='size-3.5' />
        {credits} créditos
      </Badge>
    </div>
  )
}
