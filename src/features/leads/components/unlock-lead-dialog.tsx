import { Lock, User, Phone, MapPin, Coins } from 'lucide-react'
import { toast } from 'sonner'
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
import { useCreditsStore } from '@/stores/credits-store'
import { useLeadsStore } from '@/stores/leads-store'
import { type Lead } from '../data/schema'

type UnlockLeadDialogProps = {
  lead: Lead | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function UnlockLeadDialog({
  lead,
  open,
  onOpenChange,
  onSuccess,
}: UnlockLeadDialogProps) {
  const credits = useCreditsStore((s) => s.credits)
  const consumeCredits = useCreditsStore((s) => s.consumeCredits)
  const getLeadUnlockCost = useCreditsStore((s) => s.getLeadUnlockCost)
  const unlockLead = useLeadsStore((s) => s.unlockLead)

  const cost = getLeadUnlockCost()
  const hasCredits = credits >= cost

  function handleUnlock() {
    if (!lead) return

    if (!consumeCredits(cost)) {
      toast.error('Créditos insuficientes. Compre mais créditos em Settings.')
      return
    }

    unlockLead(lead.id)
    onSuccess()
  }

  if (!lead) return null

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
                lead captado pelo WhatsApp da Avalia.
              </p>

              <div className='rounded-lg border bg-muted/50 p-4 space-y-2 text-sm'>
                <div className='flex items-center gap-2'>
                  <User className='size-4 text-muted-foreground' />
                  <span className='font-medium'>{lead.id}</span>
                </div>
                <div className='flex items-center gap-2'>
                  <MapPin className='size-4 text-muted-foreground' />
                  {lead.location} · {lead.propertyType}
                </div>
                <Badge variant='secondary'>{lead.interest}</Badge>
              </div>

              <div className='flex items-center justify-between rounded-lg border p-3'>
                <div className='flex items-center gap-2 text-sm'>
                  <Coins className='size-4' />
                  Custo: <strong>{cost} crédito</strong>
                </div>
                <div className='text-sm text-muted-foreground'>
                  Saldo: {credits} créditos
                </div>
              </div>

              {!hasCredits && (
                <p className='text-sm text-destructive'>
                  Você não possui créditos suficientes para desbloquear este
                  lead.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleUnlock} disabled={!hasCredits}>
            <Phone className='size-4' />
            Desbloquear e ver contato
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
