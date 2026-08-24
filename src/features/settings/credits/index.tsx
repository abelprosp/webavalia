import { CheckCircle2, Coins, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearch } from '@tanstack/react-router'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Badge } from '@/components/ui/badge'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ContentSection } from '../components/content-section'
import { useAuthStore } from '@/stores/auth-store'
import { fetchMe, isBrokerAccount } from '@/lib/auth-api'
import { formatDocumentForAccountType } from '@/lib/document'
import { useCreditsStore } from '@/stores/credits-store'
import {
  cancelPlanSubscription,
  createLeadCreditsPix,
  fetchMonthlyCharges,
  fetchPaymentPricing,
  type MonthlyCharge,
  type PaymentPricing,
  type PixPaymentResponse,
} from '@/lib/payment-api'
import { PixPaymentDialog } from './pix-payment-dialog'
import { TransparentCheckoutForm } from './transparent-checkout-form'
import { getApiErrorMessage } from '@/lib/api-error'
import { CREDITS_AND_PLANS_ENABLED } from '@/lib/feature-flags'
import { CreditsComingSoon } from './credits-coming-soon'

function formatChargeDate(value: string) {
  return new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function chargeStatusLabel(status: MonthlyCharge['status']) {
  if (status === 'pending') return 'Pendente'
  return 'Pago'
}

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
  const signupBonus = useAuthStore((s) => s.auth.user?.trialEvaluationsTotal ?? 2)
  const user = useAuthStore((s) => s.auth.user)
  const isBroker = isBrokerAccount(user)

  const search = useSearch({ from: '/_authenticated/settings/credits' })
  const [pricing, setPricing] = useState<PaymentPricing | null>(null)
  const [quantity, setQuantity] = useState(5)
  const [selectedPlanSlug, setSelectedPlanSlug] = useState<
    PaymentPricing['plans'][number]['slug'] | null
  >(null)
  const [cpfCnpj, setCpfCnpj] = useState('')
  const [loadingPix, setLoadingPix] = useState(false)
  const [pixPayment, setPixPayment] = useState<PixPaymentResponse | null>(null)
  const [pixDialogOpen, setPixDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [charges, setCharges] = useState<MonthlyCharge[]>([])
  const [loadingCharges, setLoadingCharges] = useState(true)
  const hasActiveSubscription = Boolean(user?.hasActiveSubscription)

  async function loadCharges() {
    setLoadingCharges(true)
    try {
      const list = await fetchMonthlyCharges()
      setCharges(list)
    } catch {
      // silencioso — histórico é complementar
    } finally {
      setLoadingCharges(false)
    }
  }

  useEffect(() => {
    fetchPaymentPricing()
      .then((data) => {
        setPricing(data)
        const audience = isBrokerAccount(user) ? 'pj' : 'pf'
        const preferred =
          data.plans.find((p) => p.audience === audience && p.highlighted) ??
          data.plans.find((p) => p.audience === audience)
        if (preferred) setSelectedPlanSlug(preferred.slug)
      })
      .catch(() => toast.error('Não foi possível carregar os preços.'))
    void loadCharges()
  }, [user])

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
      setCredits(user.credits ?? user.leadCredits ?? 0)
      await loadCharges()
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

  async function handleCancelSubscription() {
    setCancelling(true)
    try {
      await cancelPlanSubscription()
      toast.success('Assinatura cancelada. Não haverá novas cobranças.')
      setCancelDialogOpen(false)
      await refreshUser()
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Erro ao cancelar assinatura.'))
    } finally {
      setCancelling(false)
    }
  }

  if (!CREDITS_AND_PLANS_ENABLED) {
    return <CreditsComingSoon />
  }

  const creditsPerUnit = pricing?.leadCreditPack.credits ?? 1
  const pricePerUnit = pricing?.leadCreditPack.priceCents ?? 1190
  const leadCreditsTotal = creditsPerUnit * quantity
  const leadPriceTotal =
    quantity === 20
      ? Math.round(pricePerUnit * quantity * 0.9)
      : pricePerUnit * quantity
  const audiencePlans =
    pricing?.plans.filter((p) =>
      isBroker ? p.audience === 'pj' : p.audience === 'pf'
    ) ?? []
  const selectedPlan =
    audiencePlans.find((p) => p.slug === selectedPlanSlug) ?? audiencePlans[0]
  const unlockCost = pricing?.costs.leadUnlockCredits ?? 2
  const evalCost = pricing?.costs.evaluationCredits ?? 1
  const freeEvals = pricing?.freeTier.pfMonthlyEvaluations ?? 3

  return (
    <ContentSection
      title='Créditos'
      desc={
        isBroker
          ? 'Um único saldo de créditos para avaliar imóveis com IA e desbloquear leads.'
          : 'Um único saldo de créditos para avaliar imóveis com IA.'
      }
    >
      <div className='space-y-6'>
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Coins className='size-5' />
              Seu saldo
            </CardTitle>
            <CardDescription>
              {isBroker
                ? `${evalCost} crédito = 1 avaliação IA · ${unlockCost} créditos = 1 lead. Cadastro com ${signupBonus} créditos iniciais.`
                : `Plano free: ${freeEvals} avaliações/mês. Assine o Plus ou use créditos avulsos para ir além.`}
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
            <CardTitle>Dados para pagamento</CardTitle>
            <CardDescription>
              {isBroker
                ? 'CPF ou CNPJ necessário para gerar cobranças e assinaturas'
                : 'CPF necessário para gerar cobranças e assinaturas'}
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
              Planos mensais
            </CardTitle>
            <CardDescription>
              Escolha o plano e assine com cartão. Créditos renovam todo mês.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            {!hasActiveSubscription && audiencePlans.length > 0 && (
              <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                {audiencePlans.map((plan) => (
                  <button
                    key={plan.slug}
                    type='button'
                    onClick={() => setSelectedPlanSlug(plan.slug)}
                    className={`rounded-xl border p-4 text-left transition ${
                      selectedPlan?.slug === plan.slug
                        ? 'border-flux-lime bg-flux-lime/10 ring-2 ring-flux-lime/40'
                        : 'hover:border-flux-lavender/40'
                    }`}
                  >
                    <p className='font-semibold'>{plan.label}</p>
                    <p className='mt-1 text-2xl font-bold'>{plan.priceLabel}</p>
                    <p className='text-xs text-muted-foreground'>
                      {plan.credits} créditos/mês
                    </p>
                  </button>
                ))}
              </div>
            )}

            {selectedPlan && !hasActiveSubscription && (
              <div className='text-sm text-muted-foreground'>
                {selectedPlan.description}
              </div>
            )}

            {hasActiveSubscription ? (
              <div className='space-y-4'>
                <div className='flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950/40'>
                  <CheckCircle2 className='mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400' />
                  <div>
                    <p className='font-medium text-emerald-900 dark:text-emerald-100'>
                      Assinatura ativa
                    </p>
                    <p className='mt-1 text-emerald-800/80 dark:text-emerald-200/80'>
                      Seus créditos renovam todo mês. Os já creditados
                      permanecem após o cancelamento.
                    </p>
                  </div>
                </div>
                <Button
                  variant='outline'
                  className='text-destructive hover:bg-destructive/10 hover:text-destructive'
                  onClick={() => setCancelDialogOpen(true)}
                >
                  Cancelar assinatura
                </Button>
              </div>
            ) : (
              <TransparentCheckoutForm
                cpfCnpj={cpfCnpj}
                pricing={pricing}
                planSlug={selectedPlan?.slug}
                planPriceLabel={selectedPlan?.priceLabel}
                onSuccess={async (result) => {
                  if (result.status === 'paid' || result.status === 'approved') {
                    toast.success(
                      'Assinatura confirmada! Seus créditos já estão disponíveis.'
                    )
                  } else {
                    toast.success(
                      'Assinatura iniciada. Os créditos serão liberados assim que o pagamento for confirmado.'
                    )
                  }
                  await refreshUser()
                }}
              />
            )}
          </CardContent>
        </Card>

        {(hasActiveSubscription || charges.length > 0 || loadingCharges) && (
          <Card>
            <CardHeader>
              <CardTitle>Histórico das cobranças mensais</CardTitle>
              <CardDescription>
                Cobranças do plano mensal e renovações creditadas na sua conta.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingCharges ? (
                <p className='text-sm text-muted-foreground'>Carregando…</p>
              ) : charges.length === 0 ? (
                <p className='text-sm text-muted-foreground'>
                  Nenhuma cobrança registrada ainda.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Créditos</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {charges.map((charge) => (
                      <TableRow key={charge.id}>
                        <TableCell>{formatChargeDate(charge.chargedAt)}</TableCell>
                        <TableCell>{charge.label}</TableCell>
                        <TableCell>+{charge.credits}</TableCell>
                        <TableCell>{formatMoney(charge.amountCents)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              charge.status === 'pending'
                                ? 'outline'
                                : 'secondary'
                            }
                          >
                            {chargeStatusLabel(charge.status)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {isBroker && (
          <Card>
            <CardHeader>
              <CardTitle>
                {pricing?.leadCreditPack.label ?? 'Créditos avulsos (PIX)'}
              </CardTitle>
              <CardDescription>
                {pricing?.leadCreditPack.priceLabel ?? 'R$ 11,90'} por crédito ·
                packs 5, 10 ou 20 (20 com 10% off).
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='flex flex-wrap gap-2'>
                {(pricing?.leadCreditPack.allowedPacks ?? [5, 10, 20]).map(
                  (pack) => (
                    <Button
                      key={pack}
                      type='button'
                      variant={quantity === pack ? 'default' : 'outline'}
                      onClick={() => setQuantity(pack)}
                    >
                      {pack} créditos
                    </Button>
                  )
                )}
              </div>

              <div className='rounded-lg bg-muted/50 p-4 text-sm'>
                <p>
                  <strong>{leadCreditsTotal} crédito(s)</strong> —{' '}
                  {(leadPriceTotal / 100).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                  {quantity === 20 ? ' (10% off)' : ''}
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
        )}

        <Card>
          <CardHeader>
            <CardTitle>Como funcionam os créditos?</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3 text-sm text-muted-foreground'>
            <p>
              {evalCost} crédito = 1 avaliação IA
              {isBroker
                ? ` · ${unlockCost} créditos = 1 desbloqueio de lead.`
                : '.'}
            </p>
            {isBroker ? (
              <p>
                Assine Starter, Pro ou Imobiliária para ter o melhor custo por
                crédito. PIX é para urgências.
              </p>
            ) : (
              <p>
                No free você tem {freeEvals} avaliações/mês. No Plus (R$ 39,90)
                são 10 avaliações IA/mês — créditos válidos somente para
                avaliações — com publicação ilimitada. A 1ª publicação dá +2
                créditos de bônus.
              </p>
            )}
          </CardContent>
        </Card>

        <PixPaymentDialog
          open={pixDialogOpen}
          onOpenChange={setPixDialogOpen}
          payment={pixPayment}
          onPaid={refreshUser}
        />

        <ConfirmDialog
          open={cancelDialogOpen}
          onOpenChange={setCancelDialogOpen}
          title='Cancelar assinatura'
          desc='Tem certeza? A renovação mensal será interrompida e não haverá novas cobranças. Os créditos já creditados permanecem na sua conta.'
          confirmText='Cancelar assinatura'
          cancelBtnText='Manter assinatura'
          destructive
          isLoading={cancelling}
          handleConfirm={() => void handleCancelSubscription()}
        />
      </div>
    </ContentSection>
  )
}
