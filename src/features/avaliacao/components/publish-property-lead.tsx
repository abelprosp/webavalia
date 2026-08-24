import { useEffect, useState } from 'react'
import { CheckCircle2, EyeOff, KeyRound, Loader2, Tag } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { getApiErrorMessage } from '@/lib/api-error'
import {
  getEvaluationLeadStatus,
  publishEvaluationAsLead,
  unpublishEvaluationAsLead,
} from '@/lib/evaluation-api'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  getListingIntentLabel,
  type ListingIntent,
} from '@/features/avaliacao/data/evaluation-engine'

type PublishPropertyLeadProps = {
  evaluationId: string
  listingIntent: ListingIntent
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{0,2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2')
  }
  return digits
    .replace(/^(\d{0,2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
}

export function PublishPropertyLead({
  evaluationId,
  listingIntent,
}: PublishPropertyLeadProps) {
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [published, setPublished] = useState(false)
  const [unlockCount, setUnlockCount] = useState(0)
  const updateCredits = useAuthStore((s) => s.auth.updateCredits)

  useEffect(() => {
    let cancelled = false

    async function loadStatus() {
      setLoadingStatus(true)
      try {
        const status = await getEvaluationLeadStatus(evaluationId)
        if (cancelled) return
        setPublished(status.published)
        setUnlockCount(status.unlockCount)
      } catch {
        if (!cancelled) {
          setPublished(false)
          setUnlockCount(0)
        }
      } finally {
        if (!cancelled) setLoadingStatus(false)
      }
    }

    void loadStatus()
    return () => {
      cancelled = true
    }
  }, [evaluationId])

  async function handlePublish() {
    const phoneDigits = phone.replace(/\D/g, '')
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      toast.error('Informe um telefone válido com DDD.')
      return
    }
    if (!consent) {
      toast.error('Autorize o compartilhamento para continuar.')
      return
    }

    setPublishing(true)
    try {
      const result = await publishEvaluationAsLead({
        evaluationId,
        phone: phoneDigits,
        consent: true,
      })
      setPublished(true)
      setUnlockCount(0)
      if (result.credits != null) {
        updateCredits(result.credits)
      }
      if (result.creditsEarned && result.creditsEarned > 0) {
        toast.success(
          `Imóvel disponibilizado! Você ganhou +${result.creditsEarned} créditos.`
        )
      } else {
        toast.success(
          result.alreadyPublished
            ? 'Este imóvel já está disponível para imobiliárias.'
            : 'Imóvel disponibilizado para imobiliárias da região.'
        )
      }
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, 'Não foi possível disponibilizar o imóvel.')
      )
    } finally {
      setPublishing(false)
    }
  }

  async function handleWithdraw() {
    setWithdrawing(true)
    try {
      const result = await unpublishEvaluationAsLead(evaluationId)
      setPublished(false)
      setUnlockCount(0)
      if (result.unlockCount > 0) {
        toast.success(
          'Imóvel indisponibilizado. Corretores que já desbloquearam podem ainda ter seus dados.'
        )
      } else {
        toast.success('Imóvel indisponibilizado e removido dos corretores.')
      }
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, 'Não foi possível indisponibilizar o imóvel.')
      )
    } finally {
      setWithdrawing(false)
    }
  }

  const intentLabel = getListingIntentLabel(listingIntent).toLowerCase()
  const IntentIcon = listingIntent === 'alugar' ? KeyRound : Tag

  if (loadingStatus) {
    return (
      <Card className='border-primary/30'>
        <CardContent className='flex items-center gap-2 py-6 text-sm text-muted-foreground'>
          <Loader2 className='size-4 animate-spin' />
          Verificando disponibilidade do imóvel…
        </CardContent>
      </Card>
    )
  }

  if (published) {
    return (
      <Card className='border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'>
        <CardContent className='space-y-4 py-6'>
          <div className='flex items-start gap-3'>
            <CheckCircle2 className='mt-0.5 size-5 shrink-0 text-emerald-600' />
            <div>
              <p className='font-medium'>
                Imóvel disponível para imobiliárias ({intentLabel})
              </p>
              <p className='mt-1 text-sm text-muted-foreground'>
                Imobiliárias que atendem a região poderão encontrar este imóvel,
                desbloquear a avaliação completa e entrar em contato com você.
              </p>
              {unlockCount > 0 && (
                <p className='mt-2 text-sm text-muted-foreground'>
                  {unlockCount === 1
                    ? '1 corretor já desbloqueou este imóvel.'
                    : `${unlockCount} corretores já desbloquearam este imóvel.`}
                </p>
              )}
            </div>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type='button'
                variant='outline'
                disabled={withdrawing}
                className='border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive'
              >
                {withdrawing ? (
                  <Loader2 className='size-4 animate-spin' />
                ) : (
                  <EyeOff className='size-4' />
                )}
                {withdrawing
                  ? 'Indisponibilizando…'
                  : 'Indisponibilizar imóvel'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Indisponibilizar imóvel?</AlertDialogTitle>
                <AlertDialogDescription>
                  O imóvel será removido da listagem de corretores e não poderá
                  mais ser desbloqueado.{' '}
                  {unlockCount > 0
                    ? 'Corretores que já desbloquearam seus dados poderão ainda tê-los salvos.'
                    : 'Você poderá disponibilizá-lo novamente depois, se quiser.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className='bg-destructive text-white hover:bg-destructive/90'
                  onClick={() => void handleWithdraw()}
                >
                  Indisponibilizar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className='border-primary/30'>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <IntentIcon className='size-5' />
          Quer ajuda para {intentLabel} este imóvel?
        </CardTitle>
        <CardDescription>
          Disponibilize a avaliação completa para imobiliárias que atuam na
          região. Elas poderão desbloquear todos os detalhes — comparáveis, NBR
          14653, aluguel ou valor de venda — e entrar em contato com você.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='grid max-w-sm gap-2'>
          <Label htmlFor='owner-lead-phone'>Telefone com WhatsApp</Label>
          <Input
            id='owner-lead-phone'
            inputMode='tel'
            placeholder='(00) 00000-0000'
            value={phone}
            onChange={(event) => setPhone(formatPhone(event.target.value))}
          />
        </div>

        <div className='flex items-start gap-3 rounded-lg border p-3'>
          <Checkbox
            id='owner-lead-consent'
            checked={consent}
            onCheckedChange={(checked) => setConsent(checked === true)}
          />
          <Label
            htmlFor='owner-lead-consent'
            className='cursor-pointer text-sm leading-relaxed font-normal'
          >
            Autorizo o compartilhamento do meu nome, telefone, e-mail e da
            avaliação completa deste imóvel com imobiliárias interessadas. Antes
            do desbloqueio, somente a região e um resumo do imóvel serão
            exibidos.
          </Label>
        </div>

        <Button
          type='button'
          onClick={() => void handlePublish()}
          disabled={publishing || !consent}
        >
          {publishing && <Loader2 className='size-4 animate-spin' />}
          {publishing
            ? 'Disponibilizando…'
            : `Disponibilizar para ${intentLabel}`}
        </Button>
      </CardContent>
    </Card>
  )
}
