import { CheckCircle2, Coins, Minus, Plus, Sparkles } from 'lucide-react'
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
import { isBrokerAccount } from '@/lib/auth-api'
import { formatDocumentForAccountType } from '@/lib/document'
import { useCreditsStore } from '@/stores/credits-store'
import { fetchMe } from '@/lib/auth-api'
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
  const [quantity, setQuantity] = useState(1)
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
      .then(setPricing)
      .catch(() => toast.error('Não foi possível carregar os preços.'))
    void loadCharges()
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

  const creditsPerUnit = pricing?.leadCreditPack.credits ?? 1
  const pricePerUnit = pricing?.leadCreditPack.priceCents ?? 799
  const leadCreditsTotal = creditsPerUnit * quantity
  const leadPriceTotal = pricePerUnit * quantity

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
                ? `Cada conta recebe ${signupBonus} créditos ao se cadastrar e +1 ao enviar feedback após uma avaliação. Depois, compre mais créditos. 1 crédito = 1 avaliação IA ou 1 desbloqueio de lead.`
                : `Cada conta recebe ${signupBonus} créditos ao se cadastrar e +1 ao concluir a primeira avaliação. Depois, compre mais créditos. 1 crédito = 1 avaliação IA.`}
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
              {pricing?.evaluationPlan.label ?? 'Plano Mensal — 40 créditos'}
            </CardTitle>
            <CardDescription>
              {pricing?.evaluationPlan.description ??
                '40 créditos mensais para avaliações IA e leads'}
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='text-3xl font-bold text-primary'>
              {pricing?.evaluationPlan.priceLabel ?? 'R$ 97,00'}
              <span className='ml-2 text-base font-normal text-muted-foreground'>
                / mês
              </span>
            </div>
            {hasActiveSubscription ? (
              <div className='space-y-4'>
                <div className='flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950/40'>
                  <CheckCircle2 className='mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400' />
                  <div>
                    <p className='font-medium text-emerald-900 dark:text-emerald-100'>
                      Assinatura ativa
                    </p>
                    <p className='mt-1 text-emerald-800/80 dark:text-emerald-200/80'>
                      Você recebe 40 créditos todo mês. Os créditos já
                      creditados permanecem na conta após o cancelamento.
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
                {pricing?.leadCreditPack.label ?? 'Pacote avulso de créditos'}
              </CardTitle>
              <CardDescription>
                {pricing?.leadCreditPack.priceLabel ?? 'R$ 7,99'} por crédito —
                pagamento via PIX. Também entram no saldo unificado.
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
        )}

        <Card>
          <CardHeader>
            <CardTitle>Como funcionam os créditos?</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3 text-sm text-muted-foreground'>
            <p>
              Você tem um único saldo de créditos. Cada avaliação com IA consome
              1 crédito
              {isBroker
                ? ' e cada desbloqueio de lead também consome 1 crédito.'
                : '.'}
            </p>
            {isBroker && (
              <p>
                O WhatsApp da Avalia captura leads interessados em imóveis. Para
                ver nome, telefone e e-mail, use 1 crédito.
              </p>
            )}
            <p>
              {isBroker
                ? 'Cada conta começa com créditos grátis. Ao enviar feedback após uma avaliação, você ganha +1 crédito bônus. Depois disso, compre pacotes avulsos via PIX ou assine o plano mensal.'
                : 'Cada conta começa com créditos grátis. Ao concluir a primeira avaliação, você ganha +1 crédito. Depois disso, compre pacotes avulsos via PIX ou assine o plano mensal.'}
            </p>
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
