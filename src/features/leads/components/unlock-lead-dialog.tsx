import { useState } from 'react'
import { AxiosError } from 'axios'
import { Lock, User, Phone, MapPin, Coins, Loader2 } from 'lucide-react'
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
import { unlockLead, type LeadItem } from '@/lib/leads-api'

type UnlockLeadDialogProps = {
  lead: LeadItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (lead: LeadItem, credits: number) => void
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
    if (!lead) return

    setLoading(true)
    try {
      const result = await unlockLead(lead.id)
      onSuccess(result.lead, result.credits)
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

              <div className='rounded-lg border bg-muted/50 p-4 space-y-2 text-sm'>
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
