import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/features/avaliacao/data/evaluation-engine'
import { type LeadItem } from '@/lib/leads-api'

type LeadDetailDialogProps = {
  lead: LeadItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LeadDetailDialog({
  lead,
  open,
  onOpenChange,
}: LeadDetailDialogProps) {
  if (!lead) return null

  const sourceLabel =
    lead.source === 'owner_evaluation'
      ? 'avaliação autorizada pelo proprietário'
      : lead.source === 'whatsapp'
        ? 'WhatsApp da Avalia'
        : lead.source

  const insights = Array.isArray(lead.evaluationResult?.aiInsights)
    ? (lead.evaluationResult.aiInsights as string[])
    : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{lead.name}</DialogTitle>
          <DialogDescription>
            Lead recebido por {sourceLabel} em{' '}
            {new Date(lead.receivedAt).toLocaleString('pt-BR')}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 text-sm'>
          <div className='grid gap-2 rounded-lg border p-4'>
            <div>
              <span className='text-muted-foreground'>Telefone: </span>
              {lead.phone}
            </div>
            {lead.email && (
              <div>
                <span className='text-muted-foreground'>E-mail: </span>
                {lead.email}
              </div>
            )}
            <div>
              <span className='text-muted-foreground'>Local: </span>
              {lead.location}
            </div>
            <div className='flex flex-wrap gap-2 pt-1'>
              <Badge variant='secondary'>{lead.propertyType}</Badge>
              <Badge variant='outline'>{lead.interest}</Badge>
              {lead.budget !== '—' && (
                <Badge variant='outline'>{lead.budget}</Badge>
              )}
            </div>
          </div>

          {lead.hasEvaluation && lead.estimatedValue != null && (
            <div className='rounded-lg border bg-primary/5 p-4'>
              <p className='text-xs text-muted-foreground'>Valor estimado</p>
              <p className='text-2xl font-bold'>
                {formatCurrency(lead.estimatedValue)}
              </p>
              {typeof lead.evaluationResult?.scoreLabel === 'string' && (
                <p className='mt-1 text-muted-foreground'>
                  Score: {lead.evaluationResult.scoreLabel}
                </p>
              )}
            </div>
          )}

          {insights.length > 0 && (
            <div className='space-y-2'>
              <p className='font-medium'>Insights da avaliação</p>
              <ul className='list-disc space-y-1 pl-5 text-muted-foreground'>
                {insights.slice(0, 5).map((insight) => (
                  <li key={insight}>{insight}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
