import { useState } from 'react'
import { CheckCircle2, KeyRound, Loader2, Tag } from 'lucide-react'
import { toast } from 'sonner'
import { publishEvaluationAsLead } from '@/lib/evaluation-api'
import { getApiErrorMessage } from '@/lib/api-error'
import { getListingIntentLabel, type ListingIntent } from '@/features/avaliacao/data/evaluation-engine'
import { useAuthStore } from '@/stores/auth-store'
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
  const [published, setPublished] = useState(false)
  const updateCredits = useAuthStore((s) => s.auth.updateCredits)

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

  const intentLabel = getListingIntentLabel(listingIntent).toLowerCase()
  const IntentIcon = listingIntent === 'alugar' ? KeyRound : Tag

  if (published) {
    return (
      <Card className='border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'>
        <CardContent className='flex items-start gap-3 py-6'>
          <CheckCircle2 className='mt-0.5 size-5 shrink-0 text-emerald-600' />
          <div>
            <p className='font-medium'>
              Imóvel disponível para imobiliárias ({intentLabel})
            </p>
            <p className='mt-1 text-sm text-muted-foreground'>
              Imobiliárias que atendem a região poderão encontrar este imóvel,
              desbloquear a avaliação completa e entrar em contato com você.
            </p>
          </div>
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
          região. Elas poderão desbloquear todos os detalhes — comparáveis,
          NBR 14653, aluguel ou valor de venda — e entrar em contato com você.
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
            avaliação completa deste imóvel com imobiliárias interessadas.
            Antes do desbloqueio, somente a região e um resumo do imóvel serão
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
