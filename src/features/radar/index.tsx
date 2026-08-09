import { useCallback, useEffect, useMemo, useState } from 'react'
import { AxiosError } from 'axios'
import { useNavigate } from '@tanstack/react-router'
import {
  ArrowDownRight,
  Check,
  Copy,
  ExternalLink,
  Kanban,
  Loader2,
  MapPin,
  MessageCircle,
  Radar as RadarIcon,
  Sparkles,
  Trash2,
  UserRound,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { PageSkeleton } from '@/components/ui/page-skeleton'
import { Header } from '@/components/layout/header'
import { HeaderActions } from '@/components/layout/header-actions'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/flux/page-header'
import {
  fetchRadarOpportunities,
  generateRadarApproach,
  runRadarScan,
  sendRadarOpportunityToCrm,
  updateRadarOpportunityStatus,
  type CaptureOpportunity,
} from '@/lib/capture-radar-api'
import { syncCreditsFromUser, useCreditsStore } from '@/stores/credits-store'

const PROPERTY_TYPES = [
  { value: 'apartamento', label: 'Apartamento' },
  { value: 'casa', label: 'Casa' },
  { value: 'casa-condominio', label: 'Casa em condomínio' },
  { value: 'cobertura', label: 'Cobertura' },
  { value: 'studio', label: 'Studio / kitnet' },
  { value: 'sobrado', label: 'Sobrado' },
  { value: 'terreno', label: 'Terreno / lote' },
  { value: 'chacara', label: 'Chácara / sítio' },
  { value: 'comercial', label: 'Comercial' },
] as const

const UF_LIST = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
] as const

function formatBrl(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

function scoreBadgeClass(score: number | null) {
  if (score == null) return 'bg-muted text-muted-foreground'
  if (score >= 75) return 'bg-flux-lime text-flux-dark'
  if (score >= 55) return 'bg-flux-lavender/20 text-foreground'
  return 'bg-muted text-muted-foreground'
}

function statusLabel(status: CaptureOpportunity['status']) {
  switch (status) {
    case 'abordada':
      return 'Abordada'
    case 'no_crm':
      return 'No CRM'
    case 'descartada':
      return 'Descartada'
    default:
      return 'Nova'
  }
}

export function Radar() {
  const navigate = useNavigate()
  const credits = useCreditsStore((state) => state.credits)

  const [city, setCity] = useState('')
  const [uf, setUf] = useState('RS')
  const [neighborhood, setNeighborhood] = useState('')
  const [propertyType, setPropertyType] = useState('apartamento')
  const [listingIntent, setListingIntent] = useState<'vender' | 'alugar'>(
    'vender'
  )

  const [opportunities, setOpportunities] = useState<CaptureOpportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [lastScanInfo, setLastScanInfo] = useState<{
    found: number
    regionValuePerSqm: number | null
  } | null>(null)

  const [approachTarget, setApproachTarget] =
    useState<CaptureOpportunity | null>(null)
  const [approachLoading, setApproachLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const loadOpportunities = useCallback(async () => {
    try {
      const data = await fetchRadarOpportunities()
      setOpportunities(data)
    } catch {
      toast.error('Erro ao carregar oportunidades do radar.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadOpportunities()
  }, [loadOpportunities])

  const stats = useMemo(
    () => ({
      total: opportunities.length,
      novas: opportunities.filter((o) => o.status === 'nova').length,
      comDesconto: opportunities.filter(
        (o) => o.discountPercent != null && o.discountPercent >= 5
      ).length,
      noCrm: opportunities.filter((o) => o.status === 'no_crm').length,
    }),
    [opportunities]
  )

  function replaceOpportunity(updated: CaptureOpportunity) {
    setOpportunities((current) =>
      current.map((item) => (item.id === updated.id ? updated : item))
    )
  }

  async function handleScan() {
    if (city.trim().length < 2) {
      toast.error('Informe a cidade da varredura.')
      return
    }
    setScanning(true)
    try {
      const result = await runRadarScan({
        city: city.trim(),
        state: uf,
        neighborhood: neighborhood.trim() || undefined,
        propertyType,
        listingIntent,
      })
      syncCreditsFromUser(result.creditsRemaining)
      setLastScanInfo({
        found: result.found,
        regionValuePerSqm: result.regionValuePerSqm,
      })
      // Mescla o lote da varredura com o restante da lista.
      setOpportunities((current) => {
        const ids = new Set(result.opportunities.map((o) => o.id))
        return [
          ...result.opportunities,
          ...current.filter((o) => !ids.has(o.id)),
        ]
      })
      toast.success(
        result.found > 0
          ? `Varredura concluída: ${result.found} anúncio(s) analisado(s).`
          : 'Varredura concluída, mas nenhum anúncio de proprietário foi encontrado nessa região agora.'
      )
    } catch (error) {
      const message =
        error instanceof AxiosError
          ? ((error.response?.data as { message?: string })?.message ??
            'Erro na varredura.')
          : 'Erro na varredura.'
      if (error instanceof AxiosError && error.response?.status === 402) {
        toast.error(message, {
          action: {
            label: 'Comprar créditos',
            onClick: () => void navigate({ to: '/settings/credits' }),
          },
        })
      } else {
        toast.error(message)
      }
    } finally {
      setScanning(false)
    }
  }

  async function handleGenerateApproach(opportunity: CaptureOpportunity) {
    setApproachTarget(opportunity)
    setCopied(false)
    if (opportunity.approachMessage) return
    setApproachLoading(true)
    try {
      const updated = await generateRadarApproach(opportunity.id)
      replaceOpportunity(updated)
      setApproachTarget(updated)
    } catch {
      toast.error('Erro ao gerar mensagem de abordagem.')
      setApproachTarget(null)
    } finally {
      setApproachLoading(false)
    }
  }

  async function handleCopyApproach() {
    if (!approachTarget?.approachMessage) return
    await navigator.clipboard.writeText(approachTarget.approachMessage)
    setCopied(true)
    if (approachTarget.status === 'nova') {
      try {
        const updated = await updateRadarOpportunityStatus(
          approachTarget.id,
          'abordada'
        )
        replaceOpportunity(updated)
      } catch {
        // status é secundário; não bloqueia a cópia
      }
    }
    toast.success('Mensagem copiada!')
  }

  async function handleSendToCrm(opportunity: CaptureOpportunity) {
    setBusyId(opportunity.id)
    try {
      const result = await sendRadarOpportunityToCrm(opportunity.id)
      replaceOpportunity(result.opportunity)
      toast.success('Oportunidade adicionada ao pipeline do CRM!', {
        action: {
          label: 'Ver CRM',
          onClick: () => void navigate({ to: '/crm' }),
        },
      })
    } catch {
      toast.error('Erro ao adicionar ao CRM.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDiscard(opportunity: CaptureOpportunity) {
    setBusyId(opportunity.id)
    try {
      await updateRadarOpportunityStatus(opportunity.id, 'descartada')
      setOpportunities((current) =>
        current.filter((item) => item.id !== opportunity.id)
      )
    } catch {
      toast.error('Erro ao descartar oportunidade.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <Header fixed>
        <HeaderActions />
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <PageHeader
          breadcrumbs={[
            { label: 'Início', href: '/app' },
            { label: 'Radar de captação' },
          ]}
          title='Radar de Captação IA'
          description='A IA varre anúncios de proprietários na sua região, compara com o preço de mercado da Avalia e entrega a abordagem pronta.'
        />

        <Card className='border-flux-lime/30 bg-gradient-to-br from-flux-lime/10 via-transparent to-flux-lavender/10'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <RadarIcon className='size-5 text-flux-lavender' />
              Nova varredura
            </CardTitle>
            <CardDescription>
              Cada varredura custa <strong>1 crédito</strong> e busca anúncios
              publicados direto pelo proprietário. Resultados ficam salvos por 7
              dias. Saldo atual: <strong>{credits} crédito(s)</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-5'>
              <div className='space-y-1.5 lg:col-span-1'>
                <Label htmlFor='radar-city'>Cidade</Label>
                <Input
                  id='radar-city'
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  placeholder='Ex.: Lajeado'
                />
              </div>
              <div className='space-y-1.5'>
                <Label>Estado</Label>
                <Select value={uf} onValueChange={setUf}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UF_LIST.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='radar-neighborhood'>Bairro (opcional)</Label>
                <Input
                  id='radar-neighborhood'
                  value={neighborhood}
                  onChange={(event) => setNeighborhood(event.target.value)}
                  placeholder='Ex.: Centro'
                />
              </div>
              <div className='space-y-1.5'>
                <Label>Tipo de imóvel</Label>
                <Select value={propertyType} onValueChange={setPropertyType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-1.5'>
                <Label>Intenção</Label>
                <Select
                  value={listingIntent}
                  onValueChange={(value) =>
                    setListingIntent(value as 'vender' | 'alugar')
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='vender'>Venda</SelectItem>
                    <SelectItem value='alugar'>Aluguel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className='mt-4 flex flex-wrap items-center gap-3'>
              <Button
                onClick={() => void handleScan()}
                disabled={scanning}
                className='rounded-full bg-flux-lime font-semibold text-flux-dark hover:bg-flux-lime/90'
              >
                {scanning ? (
                  <>
                    <Loader2 className='size-4 animate-spin' />
                    Varrendo anúncios...
                  </>
                ) : (
                  <>
                    <Sparkles className='size-4' />
                    Varrer região (1 crédito)
                  </>
                )}
              </Button>
              {lastScanInfo?.regionValuePerSqm != null && (
                <span className='text-sm text-muted-foreground'>
                  Preço de mercado da região:{' '}
                  <strong className='text-foreground'>
                    {formatBrl(lastScanInfo.regionValuePerSqm * 100)}/m²
                  </strong>
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <div className='grid gap-4 sm:grid-cols-4'>
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-medium'>Oportunidades</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-medium'>Novas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{stats.novas}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-medium'>
                Abaixo do mercado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{stats.comDesconto}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-medium'>No CRM</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{stats.noCrm}</div>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <PageSkeleton rows={6} />
        ) : opportunities.length === 0 ? (
          <Card>
            <CardContent className='flex flex-col items-center gap-3 py-12 text-center'>
              <RadarIcon className='size-8 text-muted-foreground' />
              <p className='max-w-md text-sm text-muted-foreground'>
                Nenhuma oportunidade por enquanto. Rode uma varredura na sua
                região para encontrar imóveis anunciados direto pelo
                proprietário.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
            {opportunities.map((opportunity) => (
              <Card key={opportunity.id} className='flex flex-col'>
                <CardHeader className='pb-3'>
                  <div className='flex items-start justify-between gap-2'>
                    <Badge className={scoreBadgeClass(opportunity.opportunityScore)}>
                      Score {opportunity.opportunityScore ?? '—'}
                    </Badge>
                    <div className='flex items-center gap-1.5'>
                      {opportunity.ownerSignal && (
                        <Badge variant='outline' className='gap-1'>
                          <UserRound className='size-3' />
                          Proprietário
                        </Badge>
                      )}
                      <Badge variant='secondary'>
                        {statusLabel(opportunity.status)}
                      </Badge>
                    </div>
                  </div>
                  <CardTitle className='line-clamp-2 text-base leading-snug'>
                    {opportunity.title}
                  </CardTitle>
                  {opportunity.location && (
                    <CardDescription className='flex items-center gap-1'>
                      <MapPin className='size-3' />
                      <span className='line-clamp-1'>{opportunity.location}</span>
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className='flex flex-1 flex-col gap-3'>
                  <div className='flex flex-wrap items-center gap-x-4 gap-y-1 text-sm'>
                    <span className='font-semibold'>
                      {opportunity.priceCents != null
                        ? formatBrl(opportunity.priceCents)
                        : 'Preço não informado'}
                    </span>
                    {opportunity.area != null && (
                      <span className='text-muted-foreground'>
                        {opportunity.area} m²
                      </span>
                    )}
                    {opportunity.discountPercent != null &&
                      opportunity.discountPercent >= 3 && (
                        <Badge className='gap-1 bg-flux-lime text-flux-dark'>
                          <ArrowDownRight className='size-3' />
                          {opportunity.discountPercent}% abaixo do mercado
                        </Badge>
                      )}
                  </div>
                  {opportunity.marketValueCents != null && (
                    <p className='text-xs text-muted-foreground'>
                      Mercado (Avalia):{' '}
                      <strong className='text-foreground'>
                        {formatBrl(opportunity.marketValueCents)}
                      </strong>
                    </p>
                  )}
                  <div className='mt-auto flex flex-wrap items-center gap-2 pt-1'>
                    <Button
                      size='sm'
                      variant='outline'
                      className='rounded-full'
                      asChild
                    >
                      <a
                        href={opportunity.sourceUrl}
                        target='_blank'
                        rel='noopener noreferrer'
                      >
                        <ExternalLink className='size-3.5' />
                        {opportunity.sourcePortal ?? 'Anúncio'}
                      </a>
                    </Button>
                    <Button
                      size='sm'
                      className='rounded-full'
                      onClick={() => void handleGenerateApproach(opportunity)}
                    >
                      <MessageCircle className='size-3.5' />
                      Abordagem IA
                    </Button>
                    {opportunity.status !== 'no_crm' && (
                      <Button
                        size='sm'
                        variant='secondary'
                        className='rounded-full'
                        disabled={busyId === opportunity.id}
                        onClick={() => void handleSendToCrm(opportunity)}
                      >
                        <Kanban className='size-3.5' />
                        + CRM
                      </Button>
                    )}
                    <Button
                      size='icon'
                      variant='ghost'
                      className='ms-auto size-8 text-muted-foreground'
                      disabled={busyId === opportunity.id}
                      onClick={() => void handleDiscard(opportunity)}
                      aria-label='Descartar oportunidade'
                    >
                      <Trash2 className='size-4' />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </Main>

      <Dialog
        open={Boolean(approachTarget)}
        onOpenChange={(open) => !open && setApproachTarget(null)}
      >
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <MessageCircle className='size-5 text-flux-lavender' />
              Mensagem de abordagem
            </DialogTitle>
            <DialogDescription>
              Mensagem gerada pela IA com base no anúncio e no valor de mercado
              da região. Ajuste como quiser antes de enviar.
            </DialogDescription>
          </DialogHeader>

          {approachLoading ? (
            <div className='flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground'>
              <Loader2 className='size-4 animate-spin' />
              Gerando abordagem personalizada...
            </div>
          ) : (
            <Textarea
              value={approachTarget?.approachMessage ?? ''}
              onChange={(event) =>
                setApproachTarget((current) =>
                  current
                    ? { ...current, approachMessage: event.target.value }
                    : current
                )
              }
              rows={6}
            />
          )}

          <DialogFooter className='gap-2'>
            <Button
              variant='outline'
              onClick={() => void handleCopyApproach()}
              disabled={approachLoading || !approachTarget?.approachMessage}
            >
              {copied ? (
                <Check className='size-4' />
              ) : (
                <Copy className='size-4' />
              )}
              {copied ? 'Copiado' : 'Copiar mensagem'}
            </Button>
            <Button
              disabled={approachLoading || !approachTarget?.approachMessage}
              onClick={() => {
                if (!approachTarget?.approachMessage) return
                window.open(
                  `https://wa.me/?text=${encodeURIComponent(approachTarget.approachMessage)}`,
                  '_blank',
                  'noopener,noreferrer'
                )
              }}
            >
              <MessageCircle className='size-4' />
              Abrir no WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
