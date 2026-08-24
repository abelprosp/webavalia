import { MapPin, MoreHorizontal, Sparkles, User } from 'lucide-react'
import { getUrgencyLabel, type CrmDeal } from '@/lib/crm-api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatCurrency } from '@/features/avaliacao/data/evaluation-engine'

type DealCardProps = {
  deal: CrmDeal
  currentStageId: string
  otherStages: { id: string; name: string }[]
  onClick: () => void
  onMove: (dealId: string, stageId: string) => void
}

const urgencyVariant = {
  alta: 'destructive',
  media: 'secondary',
  baixa: 'outline',
} as const

export function DealCard({
  deal,
  currentStageId,
  otherStages,
  onClick,
  onMove,
}: DealCardProps) {
  const score = deal.leadScore
  const moveTargets = otherStages.filter((s) => s.id !== currentStageId)

  return (
    <Card
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('dealId', deal.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      className='cursor-grab rounded-xl border-black/[0.06] bg-card p-3 shadow-sm transition hover:border-flux-lime/40 active:cursor-grabbing'
      onClick={onClick}
    >
      <div className='space-y-2'>
        <div className='flex items-start justify-between gap-2'>
          <p className='text-sm leading-snug font-semibold'>{deal.title}</p>
          {moveTargets.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant='ghost'
                  size='icon'
                  className='size-7 shrink-0'
                  aria-label={`Mover negócio: ${deal.title}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className='size-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align='end'
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenuLabel>Mover para</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {moveTargets.map((stage) => (
                  <DropdownMenuItem
                    key={stage.id}
                    onClick={() => onMove(deal.id, stage.id)}
                  >
                    {stage.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {deal.clientName && (
          <p className='flex items-center gap-1.5 text-xs text-muted-foreground'>
            <User className='size-3' />
            {deal.clientName}
          </p>
        )}

        {deal.location && (
          <p className='flex items-center gap-1.5 text-xs text-muted-foreground'>
            <MapPin className='size-3 shrink-0' />
            <span className='line-clamp-1'>{deal.location}</span>
          </p>
        )}

        {score && (
          <div className='flex flex-wrap items-center gap-1.5 pt-1'>
            <Badge variant='secondary' className='gap-1 text-[10px]'>
              <Sparkles className='size-3' />
              {score.probability}%
            </Badge>
            <Badge
              variant={urgencyVariant[score.urgency]}
              className='text-[10px]'
            >
              {getUrgencyLabel(score.urgency)}
            </Badge>
            {deal.expectedTicket != null && (
              <Badge variant='outline' className='text-[10px]'>
                {formatCurrency(deal.expectedTicket)}
              </Badge>
            )}
          </div>
        )}

        {deal.tags.length > 0 && (
          <div className='flex flex-wrap gap-1'>
            {deal.tags.slice(0, 3).map((tag) => (
              <Badge
                key={tag}
                variant='outline'
                className='text-[10px] font-normal'
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}
