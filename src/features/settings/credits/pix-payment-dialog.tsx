import { useEffect, useState } from 'react'
import { Check, Copy, Loader2, QrCode } from 'lucide-react'
import { toast } from 'sonner'
import {
  pollLeadCreditsPixStatus,
  type PixPaymentResponse,
} from '@/lib/payment-api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type PixPaymentDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  payment: PixPaymentResponse | null
  onPaid: () => void
}

export function PixPaymentDialog({
  open,
  onOpenChange,
  payment,
  onPaid,
}: PixPaymentDialogProps) {
  const [copied, setCopied] = useState(false)
  const [polling, setPolling] = useState(false)

  useEffect(() => {
    if (!open || !payment?.orderId) return

    setPolling(true)
    const interval = setInterval(async () => {
      try {
        const result = await pollLeadCreditsPixStatus(payment.orderId)
        if (result.status === 'fulfilled') {
          clearInterval(interval)
          setPolling(false)
          toast.success('Pagamento confirmado! Créditos adicionados.')
          onPaid()
          onOpenChange(false)
        }
      } catch {
        // continua polling
      }
    }, 3000)

    return () => {
      clearInterval(interval)
      setPolling(false)
    }
  }, [open, payment?.orderId, onOpenChange, onPaid])

  async function handleCopy() {
    if (!payment?.brCode) return
    await navigator.clipboard.writeText(payment.brCode)
    setCopied(true)
    toast.success('Código PIX copiado!')
    setTimeout(() => setCopied(false), 2000)
  }

  const amountLabel = payment
    ? (payment.amountCents / 100).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      })
    : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <QrCode className='size-5' />
            Pagar com PIX
          </DialogTitle>
          <DialogDescription>
            Escaneie o QR Code ou copie o código. {payment?.credits} créditos —{' '}
            {amountLabel}
          </DialogDescription>
        </DialogHeader>

        {payment && (
          <div className='space-y-4'>
            {payment.brCodeBase64 && (
              <div className='flex justify-center rounded-lg border bg-white p-4'>
                <img
                  src={
                    payment.brCodeBase64.startsWith('data:')
                      ? payment.brCodeBase64
                      : `data:image/png;base64,${payment.brCodeBase64}`
                  }
                  alt='QR Code PIX'
                  className='size-48'
                />
              </div>
            )}

            <Button variant='outline' className='w-full' onClick={handleCopy}>
              {copied ? (
                <>
                  <Check className='size-4' />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className='size-4' />
                  Copiar código PIX
                </>
              )}
            </Button>

            {polling && (
              <p className='flex items-center justify-center gap-2 text-sm text-muted-foreground'>
                <Loader2 className='size-4 animate-spin' />
                Aguardando confirmação do pagamento…
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
