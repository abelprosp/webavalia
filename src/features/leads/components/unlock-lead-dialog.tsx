import { useState } from 'react'
import { AxiosError } from 'axios'
import { Coins, Loader2, Lock, MapPin, Phone, User } from 'lucide-react'
import { toast } from 'sonner'
import { useCreditsStore } from '@/stores/credits-store'
import { CREDITS_AND_PLANS_ENABLED } from '@/lib/feature-flags'
import { unlockLead, type LeadItem } from '@/lib/leads-api'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { parseLeadEvaluation } from '../lib/lead-evaluation'
import { LeadEvaluationPreview } from './lead-evaluation-preview'

type UnlockLeadDialogProps = {
  lead: LeadItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (result: {
    lead: LeadItem
    credits: number
    dealId: string | null
    addedToPipeline: boolean
  }) => void
}

function UnlockCostSummary({
  cost,
  credits,
  hasCredits,
}: {
  cost: number
  credits: number
  hasCredits: boolean
}) {
  return (
    <>
      <div className='flex flex-wrap items-center justify-between gap-2 text-sm'>
        <div className='flex items-center gap-2 text-sm'>
          <Coins className='size-4' />
          Custo: <strong>{cost} créditos</strong>
        </div>
        <div className='text-sm text-muted-foreground'>
          Saldo: {credits} créditos
        </div>
      </div>

      {!hasCredits && (
        <p className='text-sm text-destructive'>
          Você não possui créditos suficientes para desbloquear este lead.
          {!CREDITS_AND_PLANS_ENABLED &&
            ' A compra de créditos estará disponível em breve.'}
        </p>
      )}
    </>
  )
}

function LeadSummary({ lead }: { lead: LeadItem }) {
  return (
    <div className='space-y-2 rounded-lg border bg-muted/50 p-4 text-sm'>
      <div className='flex items-center gap-2'>
        <User className='size-4 text-muted-foreground' />
        <span className='font-medium'>{lead.name}</span>
      </div>
      <div className='flex items-center gap-2'>
        <MapPin className='size-4 text-muted-foreground' />
        {lead.location} · {lead.propertyType}
      </div>
      <Badge variant='secondary'>{lead.interest}</Badge>
    </div>
  )
}

export function UnlockLeadDialog({
  lead,
  open,
  onOpenChange,
  onSuccess,
}: UnlockLeadDialogProps) {
  const credits = useCreditsStore((s) => s.credits)
  const getLeadUnlockCost = useCreditsStore((s) => s.getLeadUnlockCost)
  const [loading, setLoading] = useState(false)

  const cost = getLeadUnlockCost()
  const hasCredits = credits >= cost

  async function handleUnlock() {
    if (!lead || loading || !hasCredits) return

    setLoading(true)
    try {
      const result = await unlockLead(lead.id)
      onSuccess({
        lead: result.lead,
        credits: result.credits,
        dealId: result.dealId,
        addedToPipeline: result.addedToPipeline,
      })
    } catch (error) {
      const message =
        error instanceof AxiosError
          ? (error.response?.data as { message?: string })?.message
          : error instanceof Error
            ? error.message
            : undefined
      toast.error(message ?? 'Erro ao desbloquear lead.')
    } finally {
      setLoading(false)
    }
  }

  if (!lead) return null

  const parsedEvaluation = parseLeadEvaluation(
    lead.propertyInput,
    lead.evaluationResult
  )

  if (parsedEvaluation) {
    return (
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!loading) onOpenChange(value)
        }}
      >
        <DialogContent
          showCloseButton={!loading}
          className='flex max-h-[94dvh] w-[calc(100%-1rem)] max-w-none flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:w-[calc(100%-3rem)] sm:max-w-3xl'
        >
          <div className='shrink-0 border-b px-4 py-4 pr-12 sm:px-6 sm:py-5'>
            <DialogHeader className='text-left'>
              <DialogTitle className='flex items-center gap-2'>
                <Lock className='size-5' />
                Conheça o imóvel
              </DialogTitle>
              <DialogDescription>
                Explore a avaliação antes de decidir. Desbloqueie para acessar o
                contato do proprietário.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain bg-muted/25 px-4 py-4 sm:px-6 sm:py-5'>
            <LeadEvaluationPreview
              result={parsedEvaluation.result}
              property={parsedEvaluation.property}
              location={lead.location}
            />
          </div>

          <DialogFooter className='shrink-0 flex-col gap-3 border-t bg-background px-4 py-4 sm:flex-col sm:px-6'>
            <UnlockCostSummary
              cost={cost}
              credits={credits}
              hasCredits={hasCredits}
            />
            <div className='flex flex-col-reverse gap-2 sm:flex-row sm:justify-between'>
              <Button
                variant='outline'
                disabled={loading}
                onClick={() => onOpenChange(false)}
              >
                Voltar aos leads
              </Button>
              <Button
                disabled={!hasCredits || loading}
                onClick={() => void handleUnlock()}
              >
                {loading ? (
                  <Loader2 className='size-4 animate-spin' />
                ) : (
                  <Phone className='size-4' />
                )}
                Desbloquear e ver contato
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className='flex items-center gap-2'>
            <Lock className='size-5' />
            Desbloquear lead
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className='space-y-4 pt-2'>
              <p>
                Confirme o desbloqueio para visualizar os dados completos deste
                proprietário e os detalhes da avaliação do imóvel.
              </p>

              <LeadSummary lead={lead} />

              <UnlockCostSummary
                cost={cost}
                credits={credits}
                hasCredits={hasCredits}
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              void handleUnlock()
            }}
            disabled={!hasCredits || loading}
          >
            {loading ? (
              <Loader2 className='size-4 animate-spin' />
            ) : (
              <Phone className='size-4' />
            )}
            Desbloquear e ver contato
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
