import { Kanban, Mail, Phone } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { EvaluationResultPanel } from '@/features/avaliacao/components/evaluation-result'
import {
  getListingIntentLabel,
} from '@/features/avaliacao/data/evaluation-engine'
import { type LeadItem } from '@/lib/leads-api'
import { createDealFromLead } from '@/lib/crm-api'
import {
  getLeadDisplayValue,
  parseLeadEvaluation,
} from '../lib/lead-evaluation'

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
  const navigate = useNavigate()
  const [adding, setAdding] = useState(false)

  if (!lead) return null

  const sourceLabel =
    lead.source === 'owner_evaluation'
      ? 'avaliação autorizada pelo proprietário'
      : lead.source === 'whatsapp'
        ? 'WhatsApp da Avalia'
        : lead.source

  const parsedEvaluation = parseLeadEvaluation(
    lead.propertyInput,
    lead.evaluationResult
  )
  const displayValue = getLeadDisplayValue(
    lead.propertyInput ?? { listingIntent: lead.listingIntent },
    lead.evaluationResult ??
      (lead.estimatedValue != null ? { estimatedValue: lead.estimatedValue } : null)
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          parsedEvaluation
            ? 'flex max-h-[92vh] max-w-[min(96vw,72rem)] flex-col overflow-hidden p-0'
            : 'max-h-[85vh] overflow-y-auto sm:max-w-lg'
        }
      >
        <div className={parsedEvaluation ? 'shrink-0 border-b px-6 py-5' : ''}>
          <DialogHeader className={parsedEvaluation ? 'text-left' : undefined}>
            <DialogTitle>{lead.name}</DialogTitle>
            <DialogDescription>
              Lead recebido por {sourceLabel} em{' '}
              {new Date(lead.receivedAt).toLocaleString('pt-BR')}
            </DialogDescription>
            {lead.unlocked && (
              <div className='mt-3'>
                <Button
                  size='sm'
                  disabled={adding}
                  onClick={async () => {
                    setAdding(true)
                    try {
                      await createDealFromLead(lead.id)
                      toast.success('Lead adicionado ao pipeline CRM.')
                      onOpenChange(false)
                      void navigate({ to: '/crm' })
                    } catch {
                      toast.error('Erro ao adicionar ao pipeline.')
                    } finally {
                      setAdding(false)
                    }
                  }}
                >
                  <Kanban className='me-2 size-4' />
                  Adicionar ao pipeline
                </Button>
              </div>
            )}
          </DialogHeader>

          <div className={`space-y-4 text-sm ${parsedEvaluation ? 'mt-4' : ''}`}>
            <div className='grid gap-2 rounded-lg border p-4'>
              <div className='flex items-center gap-2'>
                <Phone className='size-4 text-muted-foreground' />
                <span>{lead.phone}</span>
              </div>
              {lead.email && (
                <div className='flex items-center gap-2'>
                  <Mail className='size-4 text-muted-foreground' />
                  <span>{lead.email}</span>
                </div>
              )}
              <div>
                <span className='text-muted-foreground'>Local: </span>
                {lead.location}
              </div>
              <div className='flex flex-wrap gap-2 pt-1'>
                <Badge variant='secondary'>{lead.propertyType}</Badge>
                <Badge variant='outline'>{lead.interest}</Badge>
                <Badge variant='outline'>
                  {getListingIntentLabel(lead.listingIntent)}
                </Badge>
                {lead.budget !== '—' && (
                  <Badge variant='outline'>{lead.budget}</Badge>
                )}
              </div>
            </div>

            {!parsedEvaluation && lead.hasEvaluation && (
              <div className='rounded-lg border bg-primary/5 p-4'>
                <p className='text-xs text-muted-foreground'>{displayValue.label}</p>
                <p className='text-2xl font-bold'>
                  {lead.displayValue ?? displayValue.formatted}
                </p>
              </div>
            )}
          </div>
        </div>

        {parsedEvaluation ? (
          <div className='min-h-0 flex-1 overflow-y-auto px-6 py-5'>
            <EvaluationResultPanel
              result={parsedEvaluation.result}
              property={parsedEvaluation.property}
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
