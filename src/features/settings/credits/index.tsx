import { Coins, CreditCard, Minus, Plus, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearch } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ContentSection } from '../components/content-section'
import { useAuthStore } from '@/stores/auth-store'
import { useCreditsStore } from '@/stores/credits-store'
import { fetchMe } from '@/lib/auth-api'
import {
  createLeadCreditsPix,
  createPlanCheckout,
  fetchPaymentPricing,
  type PaymentPricing,
  type PixPaymentResponse,
} from '@/lib/payment-api'
import { PixPaymentDialog } from './pix-payment-dialog'
import { getApiErrorMessage } from '@/lib/api-error'

export function CreditsSettings() {
  const credits = useCreditsStore((s) => s.credits)
  const setCredits = useCreditsStore((s) => s.setCredits)
  const setUser = useAuthStore((s) => s.auth.setUser)
  const trialRemaining = useAuthStore(
    (s) => s.auth.user?.trialEvaluationsRemaining
  )
  const trialTotal = useAuthStore((s) => s.auth.user?.trialEvaluationsTotal ?? 3)

  const search = useSearch({ from: '/_authenticated/settings/credits' })
  const [pricing, setPricing] = useState<PaymentPricing | null>(null)
  const [packs, setPacks] = useState(1)
  const [loadingPix, setLoadingPix] = useState(false)
  const [loadingPlan, setLoadingPlan] = useState(false)
  const [pixPayment, setPixPayment] = useState<PixPaymentResponse | null>(null)
  const [pixDialogOpen, setPixDialogOpen] = useState(false)

  useEffect(() => {
    fetchPaymentPricing()
      .then(setPricing)
      .catch(() => toast.error('Não foi possível carregar os preços.'))
  }, [])

  useEffect(() => {
    if (search.payment === 'success') {
      toast.success('Pagamento recebido! Seus créditos serão atualizados em instantes.')
      void refreshUser()
    } else if (search.payment === 'cancelled') {
      toast.info('Pagamento cancelado.')
    }
  }, [search.payment])

  async function refreshUser() {
    try {
      const user = await fetchMe()
      setUser(user)
      setCredits(user.leadCredits)
    } catch {
      // silencioso
    }
  }

  async function handleBuyLeadCredits() {
    setLoadingPix(true)
    try {
      const pix = await createLeadCreditsPix(packs)
      setPixPayment(pix)
      setPixDialogOpen(true)
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Erro ao gerar cobrança PIX.'))
    } finally {
      setLoadingPix(false)
    }
  }

  async function handleBuyPlan() {
    setLoadingPlan(true)
    try {
      const checkout = await createPlanCheckout()
      window.location.href = checkout.checkoutUrl
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Erro ao iniciar checkout.'))
      setLoadingPlan(false)
    }
  }

  const leadCreditsTotal =
    (pricing?.leadCreditPack.credits ?? 2) * packs
  const leadPriceTotal =
    (pricing?.leadCreditPack.priceCents ?? 799) * packs

  return (
    <ContentSection
      title='Créditos'
      desc='Compre créditos para desbloquear leads e plano de avaliações com IA.'
    >
      <div className='space-y-6'>
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Sparkles className='size-5' />
              Avaliações com IA
            </CardTitle>
            <CardDescription>
              Cada conta recebe {trialTotal} avaliações grátis ao se cadastrar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='text-4xl font-bold text-primary'>
              {trialRemaining ?? '—'}
            </div>
            <p className='mt-1 text-sm text-muted-foreground'>
              avaliações restantes
            </p>
          </CardContent>
        </Card>

        <Card className='border-primary'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Sparkles className='size-5' />
              {pricing?.evaluationPlan.label ?? 'Plano Mensal — 50 avaliações IA'}
            </CardTitle>
            <CardDescription>
              {pricing?.evaluationPlan.description ??
                '50 créditos mensais de avaliação com IA'}
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='text-3xl font-bold text-primary'>
              {pricing?.evaluationPlan.priceLabel ?? 'R$ 97,00'}
              <span className='ml-2 text-base font-normal text-muted-foreground'>
                / mês
              </span>
            </div>
            <p className='text-sm text-muted-foreground'>
              Pagamento via PIX ou cartão de crédito
            </p>
            <Button
              className='w-full sm:w-auto'
              onClick={handleBuyPlan}
              disabled={loadingPlan}
            >
              <CreditCard className='size-4' />
              {loadingPlan ? 'Redirecionando…' : 'Assinar plano'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Coins className='size-5' />
              Saldo de créditos (leads)
            </CardTitle>
            <CardDescription>
              Cada lead captado pelo WhatsApp custa 1 crédito para desbloquear
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='text-4xl font-bold text-primary'>{credits}</div>
            <p className='mt-1 text-sm text-muted-foreground'>
              créditos disponíveis
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {pricing?.leadCreditPack.label ?? '2 créditos de leads'}
            </CardTitle>
            <CardDescription>
              {pricing?.leadCreditPack.priceLabel ?? 'R$ 7,99'} por pacote — pagamento
              somente via PIX
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='flex items-center gap-4'>
              <Button
                variant='outline'
                size='icon'
                onClick={() => setPacks((p) => Math.max(1, p - 1))}
                disabled={packs <= 1}
              >
                <Minus className='size-4' />
              </Button>
              <span className='min-w-24 text-center text-lg font-medium'>
                {packs} {packs === 1 ? 'pacote' : 'pacotes'}
              </span>
              <Button
                variant='outline'
                size='icon'
                onClick={() => setPacks((p) => Math.min(20, p + 1))}
                disabled={packs >= 20}
              >
                <Plus className='size-4' />
              </Button>
            </div>

            <div className='rounded-lg bg-muted/50 p-4 text-sm'>
              <p>
                <strong>{leadCreditsTotal} créditos</strong> —{' '}
                {(leadPriceTotal / 100).toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </p>
            </div>

            <Button
              className='w-full'
              onClick={handleBuyLeadCredits}
              disabled={loadingPix}
            >
              {loadingPix ? 'Gerando PIX…' : 'Pagar com PIX'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Como funcionam os créditos?</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3 text-sm text-muted-foreground'>
            <p>
              O WhatsApp da Avalia captura leads de pessoas interessadas em
              imóveis e os disponibiliza na plataforma de forma anonimizada.
            </p>
            <p>
              Para visualizar nome, telefone e e-mail de um lead, o corretor
              utiliza 1 crédito para desbloqueá-lo.
            </p>
            <p>
              As avaliações com IA consomem créditos de avaliação. Compre o
              plano mensal para receber 50 avaliações por mês.
            </p>
          </CardContent>
        </Card>

        <PixPaymentDialog
          open={pixDialogOpen}
          onOpenChange={setPixDialogOpen}
          payment={pixPayment}
          onPaid={refreshUser}
        />
      </div>
    </ContentSection>
  )
}
