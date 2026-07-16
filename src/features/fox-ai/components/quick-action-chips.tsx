import {
  BarChart3,
  Building2,
  Coins,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { SuggestedPrompt } from '@/lib/fox-ai-api'
import { cn } from '@/lib/utils'

const iconMap = {
  portfolio: Building2,
  opportunity: Target,
  pricing: Coins,
  market: BarChart3,
  risk: TrendingUp,
  leads: Sparkles,
} as const

type QuickActionChipsProps = {
  prompts: SuggestedPrompt[]
  onSelect: (message: string) => void
  disabled?: boolean
  className?: string
}

export function QuickActionChips({
  prompts,
  onSelect,
  disabled,
  className,
}: QuickActionChipsProps) {
  if (prompts.length === 0) return null

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {prompts.map((prompt) => {
        const Icon = iconMap[prompt.icon] ?? Sparkles
        return (
          <Badge
            key={prompt.id}
            variant='outline'
            className={cn(
              'cursor-pointer gap-1.5 px-3 py-1.5 text-xs font-normal transition-colors hover:bg-orange-500/10 hover:border-orange-500/40',
              disabled && 'pointer-events-none opacity-50'
            )}
            onClick={() => !disabled && onSelect(prompt.message)}
          >
            <Icon className='size-3 text-orange-500' />
            {prompt.label}
          </Badge>
        )
      })}
    </div>
  )
}
