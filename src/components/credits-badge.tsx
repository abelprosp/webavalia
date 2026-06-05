import { Coins } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useCreditsStore } from '@/stores/credits-store'

export function CreditsBadge() {
  const credits = useCreditsStore((s) => s.credits)

  return (
    <Badge variant='secondary' className='gap-1.5 px-3 py-1.5 font-medium'>
      <Coins className='size-3.5' />
      {credits} créditos
    </Badge>
  )
}
