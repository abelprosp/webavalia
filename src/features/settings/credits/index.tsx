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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ContentSection } from '../components/content-section'
import { useAuthStore } from '@/stores/auth-store'
import { isBrokerAccount } from '@/lib/auth-api'
import { formatDocumentForAccountType } from '@/lib/document'
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

function formatCpfCnpj(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14)
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

export function CreditsSettings() {
  const credits = useCreditsStore((s) => s.credits)
  const setCredits = useCreditsStore((s) => s.setCredits)
  const setUser = useAuthStore((s) => s.auth.setUser)
  const trialRemaining = useAuthStore(
    (s) => s.auth.user?.trialEvaluationsRemaining
  )
  const trialTotal = useAuthStore((s) => s.auth.user?.trialEvaluationsTotal ?? 3)
  const user = useAuthStore((s) => s.auth.user)
  const isBroker = isBrokerAccount(user)

  const search = useSearch({ from: '/_authenticated/settings/credits' })
  const [pricing, setPricing] = useState<PaymentPricing | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [cpfCnpj, setCpfCnpj] = useState('')
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
    if (user?.document) {
      setCpfCnpj(
        formatDocumentForAccountType(user.accountType, user.document)
      )
    }
  }, [user?.document, user?.accountType])

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

  function getCpfDigits() {
    return cpfCnpj.replace(/\D/g, '')
  }

  function validateCpfCnpj() {
    const digits = getCpfDigits()
    if (isBroker) {
      if (digits.length !== 11 && digits.length !== 14) {
        toast.error('Informe um CPF ou CNPJ válido para continuar.')
        return false
      }
      return true
    }
    if (digits.length !== 11) {
      toast.error('Informe um CPF válido para continuar.')
      return false
    }
    return true
  }

  async function handleBuyLeadCredits() {
    if (!validateCpfCnpj()) return

    setLoadingPix(true)
    try {
      const pix = await createLeadCreditsPix({
        packs: quantity,
        cpfCnpj: getCpfDigits(),
      })
      setPixPayment(pix)
      setPixDialogOpen(true)
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Erro ao gerar cobrança PIX.'))
    } finally {
      setLoadingPix(false)
    }
  }

  async function handleBuyPlan() {
    if (!validateCpfCnpj()) return

    setLoadingPlan(true)
    try {
      const checkout = await createPlanCheckout(getCpfDigits())
      window.location.href = checkout.checkoutUrl
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Erro ao iniciar assinatura.'))
      setLoadingPlan(false)
    }
  }

  const creditsPerUnit = pricing?.leadCreditPack.credits ?? 1
  const pricePerUnit = pricing?.leadCreditPack.priceCents ?? 799
  const leadCreditsTotal = creditsPerUnit * quantity
  const leadPriceTotal = pricePerUnit * quantity

  return (
    <ContentSection
      title='Créditos'
      desc={
        isBroker
          ? 'Compre créditos para desbloquear leads e assine o plano de avaliações com IA.'
          : 'Assine o plano de avaliações com IA para continuar avaliando imóveis.'
      }
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

        <Card>
          <CardHeader>
            <CardTitle>Dados para pagamento</CardTitle>
            <CardDescription>
              {isBroker
                ? 'CPF ou CNPJ exigido pelo Asaas para gerar cobranças e assinaturas'
                : 'CPF exigido pelo Asaas para gerar cobranças e assinaturas'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='grid gap-2 max-w-sm'>
              <Label htmlFor='cpfCnpj'>{isBroker ? 'CPF ou CNPJ' : 'CPF'}</Label>
              <Input
                id='cpfCnpj'
                inputMode='numeric'
                placeholder={isBroker ? '000.000.000-00' : '000.000.000-00'}
                value={cpfCnpj}
                onChange={(e) =>
                  setCpfCnpj(
                    isBroker
                      ? formatCpfCnpj(e.target.value)
                      : formatDocumentForAccountType('pf', e.target.value)
                  )
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card className='border-primary'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Sparkles className='size-5' />
              {pricing?.evaluationPlan.label ?? 'Plano Mensal — 40 avaliações IA'}
            </CardTitle>
            <CardDescription>
              {pricing?.evaluationPlan.description ??
                '40 créditos mensais de avaliação com IA'}
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
              Assinatura recorrente via Asaas — PIX ou cartão de crédito
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

        {isBroker && (
          <>
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
                  {pricing?.leadCreditPack.label ?? '1 crédito de lead'}
                </CardTitle>
                <CardDescription>
                  {pricing?.leadCreditPack.priceLabel ?? 'R$ 7,99'} por crédito —
                  pagamento somente via PIX
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='flex items-center gap-4'>
                  <Button
                    variant='outline'
                    size='icon'
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                  >
                    <Minus className='size-4' />
                  </Button>
                  <span className='min-w-24 text-center text-lg font-medium'>
                    {quantity} {quantity === 1 ? 'crédito' : 'créditos'}
                  </span>
                  <Button
                    variant='outline'
                    size='icon'
                    onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                    disabled={quantity >= 20}
                  >
                    <Plus className='size-4' />
                  </Button>
                </div>

                <div className='rounded-lg bg-muted/50 p-4 text-sm'>
                  <p>
                    <strong>{leadCreditsTotal} crédito(s)</strong> —{' '}
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
          </>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Como funcionam os créditos?</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3 text-sm text-muted-foreground'>
            {isBroker ? (
              <>
                <p>
                  O WhatsApp da Avalia captura leads de pessoas interessadas em
                  imóveis e os disponibiliza na plataforma de forma anonimizada.
                </p>
                <p>
                  Para visualizar nome, telefone e e-mail de um lead, o corretor
                  utiliza 1 crédito para desbloqueá-lo.
                </p>
              </>
            ) : (
              <p>
                Contas de pessoa física podem avaliar imóveis com IA e assinar o
                plano mensal de avaliações.
              </p>
            )}
            <p>
              As avaliações com IA consomem créditos de avaliação. Assine o plano
              mensal para receber 40 avaliações por mês.
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
