import { useState } from 'react'
import {
  TrendingUp,
  MapPin,
  ExternalLink,
  Landmark,
  FileDown,
  Loader2,
  BookmarkPlus,
  MapPinned,
  Sparkles,
  Building2,
  Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { isBrokerAccount } from '@/lib/auth-api'
import { useAuthStore } from '@/stores/auth-store'
import { useCrmStore } from '@/stores/crm-store'
import {
  CrmSavedToastAction,
  SaveToCrmDialog,
} from '@/features/crm/components/save-to-crm-dialog'
import { Button } from '@/components/ui/button'
import {
  getFinishLevelLabel,
  getFurnishingLabel,
  getStandardLevelLabel,
} from '../data/criteria'
import {
  formatCurrency,
  estimateMonthlyRent,
  getListingIntentLabel,
  getSaleScenarios,
  type EvaluationFormValues,
  type EvaluationResult,
  type SaleScenario,
} from '../data/evaluation-engine'
import { exportEvaluationPdf } from '../lib/export-evaluation-pdf'
import { Nbr14653Panel } from './nbr-14653-panel'
import { BentoCard, FluxBadge, MetricIcon } from './bento-card'

type EvaluationResultPanelProps = {
  result: EvaluationResult
  property: EvaluationFormValues
}

function getPropertyHighlights(property: EvaluationFormValues) {
  const highlights: string[] = []
  if (property.standardLevel && property.standardLevel !== 'padrao') {
    highlights.push(getStandardLevelLabel(property.standardLevel))
  }
  if (property.furnishing && property.furnishing !== 'sem') {
    highlights.push(getFurnishingLabel(property.furnishing))
  }
  if (property.finishLevel && !['basico', 'padrao'].includes(property.finishLevel)) {
    highlights.push(`Acabamento ${getFinishLevelLabel(property.finishLevel).toLowerCase()}`)
  }
  if (property.amenities?.length) {
    highlights.push(`${property.amenities.length} diferenciais`)
  }
  return highlights
}

function getCriterionScore(result: EvaluationResult, id: string) {
  return result.criteriaScores.find((c) => c.id === id)?.score ?? 3
}

function compactCurrency(value: number) {
  if (value >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toFixed(1).replace('.', ',')}M`
  }
  if (value >= 1_000) {
    return `R$ ${Math.round(value / 1_000)}k`
  }
  return formatCurrency(value)
}

function ValueBreakdownCircles({
  total,
  location,
  construction,
  market,
}: {
  total: number
  location: number
  construction: number
  market: number
}) {
  const sum = location + construction + market || 1
  const locVal = Math.round(total * (location / sum))
  const conVal = Math.round(total * (construction / sum))
  const mktVal = total - locVal - conVal

  return (
    <div className='relative mx-auto my-5 flex h-[148px] w-full max-w-[240px] items-center justify-center'>
      <div
        className='absolute left-1/2 top-1/2 flex size-[108px] -translate-x-[62%] -translate-y-1/2 flex-col items-center justify-center rounded-full bg-flux-lavender/90 text-flux-dark shadow-sm'
        style={{ zIndex: 1 }}
      >
        <span className='text-[10px] font-medium opacity-60'>Localização</span>
        <span className='text-sm font-bold'>{compactCurrency(locVal)}</span>
      </div>
      <div
        className='absolute left-1/2 top-1/2 flex size-[88px] -translate-x-[18%] -translate-y-[58%] flex-col items-center justify-center rounded-full bg-flux-dark text-white shadow-md'
        style={{ zIndex: 2 }}
      >
        <span className='text-[10px] font-medium opacity-60'>Construção</span>
        <span className='text-xs font-bold'>{compactCurrency(conVal)}</span>
      </div>
      <div
        className='absolute left-1/2 top-1/2 flex size-[68px] -translate-x-[5%] -translate-y-[12%] flex-col items-center justify-center rounded-full bg-flux-lime text-flux-dark shadow-sm'
        style={{ zIndex: 3 }}
      >
        <span className='text-[9px] font-medium opacity-60'>Mercado</span>
        <span className='text-[11px] font-bold'>{compactCurrency(mktVal)}</span>
      </div>
    </div>
  )
}

function DotMatrix({ filled, total = 25 }: { filled: number; total?: number }) {
  return (
    <div className='grid grid-cols-5 gap-[5px]'>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`size-[9px] rounded-full transition-colors ${
            i < filled ? 'bg-flux-lavender' : 'bg-muted'
          }`}
        />
      ))}
    </div>
  )
}

const BAR_COLORS = ['bg-flux-lavender', 'bg-flux-dark', 'bg-flux-lime'] as const

const SALE_SCENARIO_STYLES: Record<
  SaleScenario['id'],
  { badge: 'lime' | 'lavender' | 'dark'; ring: string }
> = {
  rapida: {
    badge: 'lime',
    ring: 'ring-flux-lime/40',
  },
  moderada: {
    badge: 'lavender',
    ring: 'ring-flux-lavender/50',
  },
  lenta: {
    badge: 'dark',
    ring: 'ring-flux-dark/15',
  },
}

function SaleScenarioCard({ scenario }: { scenario: SaleScenario }) {
  const styles = SALE_SCENARIO_STYLES[scenario.id]
  const adjustmentLabel =
    scenario.adjustmentPercent === 0
      ? 'Valor de mercado'
      : `${scenario.adjustmentPercent > 0 ? '+' : ''}${scenario.adjustmentPercent}% vs. estimado`

  return (
    <div
      className={`flex flex-col rounded-2xl border border-black/[0.04] bg-muted/25 p-4 ring-1 ${styles.ring}`}
    >
      <div className='mb-3 flex items-start justify-between gap-2'>
        <div>
          <p className='text-[13px] font-semibold tracking-tight'>{scenario.label}</p>
          <p className='mt-0.5 text-[11px] text-muted-foreground'>{scenario.description}</p>
        </div>
        <FluxBadge variant={styles.badge}>{scenario.timeframe}</FluxBadge>
      </div>
      <p className='text-xl font-bold tracking-tight'>{formatCurrency(scenario.value)}</p>
      <p className='mt-1 text-[11px] text-muted-foreground'>
        {formatCurrency(scenario.valuePerSqm)}/m² · {adjustmentLabel}
      </p>
    </div>
  )
}

function HeroCriteriaBars({
  criteria,
}: {
  criteria: EvaluationResult['criteriaScores']
}) {
  return (
    <div className='mt-auto space-y-2.5 pt-2'>
      {criteria.slice(0, 3).map((c, i) => (
        <div key={c.id}>
          <div className='mb-1 flex justify-between text-[11px]'>
            <span className='text-muted-foreground'>{c.label}</span>
            <span className='font-semibold'>
              {Math.round((c.score / 5) * 100)}%
            </span>
          </div>
          <div className='h-[7px] overflow-hidden rounded-full bg-muted/80'>
            <div
              className={`h-full rounded-full ${BAR_COLORS[i % BAR_COLORS.length]}`}
              style={{ width: `${(c.score / 5) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function AppreciationBars() {
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul']
  const heights = [38, 52, 44, 58, 48, 66, 82]
  return (
    <div className='mt-auto flex items-end justify-between gap-0.5 pt-5'>
      {months.map((month, i) => {
        const isActive = i === months.length - 1
        return (
          <div key={month} className='flex flex-1 flex-col items-center gap-1.5'>
            <div
              className='flex w-full items-end justify-center gap-[3px]'
              style={{ height: 56 }}
            >
              {isActive ? (
                <>
                  <div
                    className='w-[7px] rounded-t-full bg-flux-lime'
                    style={{ height: `${heights[i]}%` }}
                  />
                  <div
                    className='w-[7px] rounded-t-full bg-flux-lavender'
                    style={{ height: `${heights[i] * 0.72}%` }}
                  />
                </>
              ) : (
                <div
                  className='w-full max-w-[14px] rounded-t-[4px] bg-white/[0.08]'
                  style={{
                    height: `${heights[i]}%`,
                    backgroundImage:
                      'repeating-linear-gradient(-45deg, transparent, transparent 2px, rgba(255,255,255,0.04) 2px, rgba(255,255,255,0.04) 4px)',
                  }}
                />
              )}
            </div>
            <span className='text-[9px] font-medium text-white/30'>{month}</span>
          </div>
        )
      })}
    </div>
  )
}

export function EvaluationResultPanel({
  result,
  property,
}: EvaluationResultPanelProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const authUser = useAuthStore((s) => s.auth.user)
  const isBroker = isBrokerAccount(authUser)
  const saveEvaluation = useCrmStore((s) => s.saveEvaluation)
  const { marketAnalysis, masterPlanAnalysis } = result
  const propertyHighlights = getPropertyHighlights(property)
  const isRentalView = (property.listingIntent ?? 'vender') === 'alugar'
  const rentalEstimate = isRentalView
    ? estimateMonthlyRent(result.estimatedValue, property)
    : null
  const saleScenarios = !isRentalView
    ? getSaleScenarios(result, property.area)
    : null

  const locationScore = getCriterionScore(result, 'location')
  const conditionScore = getCriterionScore(result, 'condition')
  const marketScore = getCriterionScore(result, 'market')
  const neighborhoodDots = Math.round((locationScore / 5) * 25)
  const growthPct = result.marketAppreciationAnalysis?.annualGrowthEstimatePercent

  async function handleExportPdf() {
    setIsExporting(true)
    try {
      await exportEvaluationPdf({ result, property })
      toast.success('PDF exportado com sucesso!')
    } catch {
      toast.error('Não foi possível gerar o PDF. Tente novamente.')
    } finally {
      setIsExporting(false)
    }
  }

  function handleSaveToCrm(data: {
    clientName?: string
    notes?: string
    status: 'novo' | 'em_negociacao' | 'proposta' | 'fechado' | 'arquivado'
  }) {
    saveEvaluation({ property, result, ...data })
    toast.success(
      isBroker
        ? 'Avaliação salva no CRM!'
        : 'Avaliação salva em minhas avaliações!',
      {
        action: <CrmSavedToastAction mode={isBroker ? 'broker' : 'personal'} />,
      }
    )
  }

  return (
    <>
      <div className='space-y-5'>
        {/* Header */}
        <div className='flex flex-wrap items-end justify-between gap-4'>
          <div>
            <div className='mb-1 flex items-center gap-2'>
              <Sparkles className='size-4 text-flux-dark' />
              <span className='text-xs font-semibold uppercase tracking-widest text-muted-foreground'>
                Resultado
              </span>
            </div>
            <h2 className='text-[1.65rem] font-bold tracking-tight'>
              {isRentalView ? 'Avaliação de aluguel' : 'Visão da avaliação'}
            </h2>
            <p className='mt-0.5 max-w-lg text-sm text-muted-foreground'>
              {property.address}
            </p>
            <p className='text-xs text-muted-foreground/70'>
              Objetivo: {getListingIntentLabel(property.listingIntent ?? 'vender')} ·{' '}
              {result.evaluatedAt.toLocaleString('pt-BR', {
                dateStyle: 'long',
                timeStyle: 'short',
              })}
            </p>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <Button
              variant='outline'
              size='sm'
              className='h-9 rounded-full border-black/[0.08] bg-card px-4 shadow-sm'
              onClick={() => setSaveDialogOpen(true)}
            >
              <BookmarkPlus className='size-3.5' />
              {isBroker ? 'Salvar no CRM' : 'Salvar em minhas avaliações'}
            </Button>
            <Button
              variant='outline'
              size='sm'
              className='h-9 rounded-full border-black/[0.08] bg-card px-4 shadow-sm'
              onClick={handleExportPdf}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className='size-3.5 animate-spin' />
              ) : (
                <FileDown className='size-3.5' />
              )}
              Exportar PDF
            </Button>
            <FluxBadge className='h-9 px-4 text-sm'>{result.scoreLabel}</FluxBadge>
          </div>
        </div>

        {/* Row 1 — Hero + métricas */}
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          <BentoCard
            title={isRentalView ? 'Aluguel estimado' : 'Valor estimado'}
            subtitle={
              isRentalView
                ? 'Locação mensal · com base no valor de mercado'
                : 'Determinação de mercado · NBR 14653'
            }
            className='min-h-[420px] sm:col-span-2 lg:col-span-1 lg:row-span-2'
          >
            <div className='flex items-start justify-between gap-2'>
              <div>
                {isRentalView && rentalEstimate ? (
                  <>
                    <p className='text-[2rem] font-bold leading-none tracking-tight'>
                      {formatCurrency(rentalEstimate.monthlyRent)}
                      <span className='text-lg font-semibold text-muted-foreground'>
                        /mês
                      </span>
                    </p>
                    <p className='mt-1.5 text-sm font-medium text-muted-foreground'>
                      {formatCurrency(rentalEstimate.rentPerSqm)}/m² · aluguel
                    </p>
                    <p className='mt-1 text-xs text-muted-foreground/80'>
                      Valor de venda de referência:{' '}
                      {formatCurrency(result.estimatedValue)} (
                      {rentalEstimate.annualYieldPercent.toFixed(1)}% a.a.)
                    </p>
                  </>
                ) : (
                  <>
                    <p className='text-[2rem] font-bold leading-none tracking-tight'>
                      {formatCurrency(result.estimatedValue)}
                    </p>
                    <p className='mt-1.5 text-sm font-medium text-muted-foreground'>
                      {formatCurrency(result.valuePerSqm)}/m²
                    </p>
                  </>
                )}
              </div>
              {growthPct != null && (
                <FluxBadge>+{growthPct}%</FluxBadge>
              )}
            </div>

            <ValueBreakdownCircles
              total={
                isRentalView && rentalEstimate
                  ? rentalEstimate.monthlyRent
                  : result.estimatedValue
              }
              location={locationScore}
              construction={conditionScore}
              market={marketScore}
            />

            <HeroCriteriaBars criteria={result.criteriaScores} />

            {propertyHighlights.length > 0 && (
              <div className='mt-4 flex flex-wrap gap-1.5 border-t border-black/[0.04] pt-4'>
                {propertyHighlights.map((h) => (
                  <span
                    key={h}
                    className='rounded-full bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground'
                  >
                    {h}
                  </span>
                ))}
              </div>
            )}
          </BentoCard>

          <BentoCard title='Mercado local' subtitle='Comparáveis e faixa de preços'>
            <div className='flex items-start justify-between gap-3'>
              <div>
                <p className='text-2xl font-bold tracking-tight'>
                  {marketAnalysis.averagePricePerSqm != null
                    ? formatCurrency(marketAnalysis.averagePricePerSqm)
                    : '—'}
                </p>
                <p className='mt-0.5 text-[11px] text-muted-foreground'>média / m²</p>
                <p className='mt-2 text-[11px] font-semibold text-muted-foreground'>
                  {marketAnalysis.comparables.length} comparáveis
                </p>
              </div>
              <MetricIcon className='bg-flux-lavender/25'>
                <Building2 className='size-5 text-flux-dark/70' />
              </MetricIcon>
            </div>
            {marketAnalysis.priceRange && (
              <p className='mt-3 text-[11px] text-muted-foreground'>
                Faixa:{' '}
                <span className='font-medium text-foreground'>
                  {formatCurrency(marketAnalysis.priceRange.min)} –{' '}
                  {formatCurrency(marketAnalysis.priceRange.max)}
                </span>
              </p>
            )}
            <p className='mt-2 line-clamp-3 text-[11px] leading-relaxed text-muted-foreground'>
              {marketAnalysis.summary}
            </p>
          </BentoCard>

          <BentoCard title='Zoneamento' subtitle='Plano Diretor'>
            <div className='flex items-start justify-between gap-3'>
              <div className='min-w-0'>
                <p className='text-lg font-bold leading-tight tracking-tight'>
                  {masterPlanAnalysis.zoning.split(/[,;]/)[0]?.trim() ||
                    masterPlanAnalysis.zoning.slice(0, 30)}
                </p>
                <p className='mt-1 text-[11px] text-muted-foreground'>
                  {masterPlanAnalysis.allowedUses.length} uso(s) permitido(s)
                </p>
                <p className='mt-2 line-clamp-2 text-[11px] text-muted-foreground'>
                  {masterPlanAnalysis.developmentPotential}
                </p>
              </div>
              <MetricIcon className='bg-flux-lavender/25'>
                <Landmark className='size-5 text-flux-dark/70' />
              </MetricIcon>
            </div>
          </BentoCard>

          <BentoCard title='Score do bairro' subtitle='Localização e infraestrutura'>
            <p className='text-[2rem] font-bold leading-none tracking-tight'>
              {Math.round((locationScore / 5) * 100)}%
            </p>
            <FluxBadge className='mt-2'>+{locationScore * 4}%</FluxBadge>
            <div className='mt-auto pt-5'>
              <DotMatrix filled={neighborhoodDots} />
            </div>
          </BentoCard>

          {result.marketAppreciationAnalysis && (
            <BentoCard title='Valorização' subtitle='Tendência de mercado'>
              <div className='flex items-start justify-between gap-3'>
                <div>
                  <p className='text-xl font-bold tracking-tight'>
                    {result.marketAppreciationAnalysis.trendLabel}
                  </p>
                  {result.marketAppreciationAnalysis.annualGrowthEstimatePercent != null && (
                    <FluxBadge className='mt-2'>
                      +{result.marketAppreciationAnalysis.annualGrowthEstimatePercent}%/ano
                    </FluxBadge>
                  )}
                  <p className='mt-2 line-clamp-2 text-[11px] text-muted-foreground'>
                    {result.marketAppreciationAnalysis.liquidity}
                  </p>
                </div>
                <MetricIcon className='bg-flux-lime/30'>
                  <TrendingUp className='size-5 text-flux-dark/70' />
                </MetricIcon>
              </div>
            </BentoCard>
          )}
        </div>

        {!isRentalView && saleScenarios && (
          <BentoCard
            title='Cenários de venda'
            subtitle='Faixas de preço conforme tempo esperado para vender'
            className='col-span-full'
          >
            <div className='mb-3 flex items-center gap-2 text-[11px] text-muted-foreground'>
              <Clock className='size-3.5 shrink-0' />
              <span>
                Baseado no valor estimado de {formatCurrency(result.estimatedValue)} ·
                ajustes de −10% (rápida), mercado (moderada) e +8% (lenta)
              </span>
            </div>
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
              {saleScenarios.map((scenario) => (
                <SaleScenarioCard key={scenario.id} scenario={scenario} />
              ))}
            </div>
          </BentoCard>
        )}

        {/* Row 2 — Bairro dark + critérios + comparáveis + insights */}
        <div className='grid grid-cols-1 gap-4 lg:grid-cols-4'>
          {result.neighborhoodAnalysis && (
            <BentoCard
              variant='dark'
              title='Pesquisa avançada do bairro'
              subtitle={result.neighborhoodAnalysis.qualityOfLife.slice(0, 55)}
              className='min-h-[280px] lg:col-span-2'
              showMenu
            >
              <div className='grid gap-4 sm:grid-cols-2'>
                <div>
                  <p className='text-[10px] font-semibold uppercase tracking-wider text-white/40'>
                    Segurança percebida
                  </p>
                  <p className='mt-1 text-base font-semibold leading-snug'>
                    {result.neighborhoodAnalysis.safetyPerception.split(/[.,]/)[0]}
                  </p>
                </div>
                <div>
                  <p className='text-[10px] font-semibold uppercase tracking-wider text-white/40'>
                    Demanda / liquidez
                  </p>
                  <p className='mt-1 text-base font-semibold leading-snug'>
                    {result.marketAppreciationAnalysis?.demandLevel?.split(/[.,]/)[0] ??
                      'Alta demanda'}
                  </p>
                </div>
              </div>
              <p className='mt-3 line-clamp-2 text-[13px] leading-relaxed text-white/60'>
                {result.neighborhoodAnalysis.overview}
              </p>
              <AppreciationBars />
            </BentoCard>
          )}

          <BentoCard
            title='Pontuação por critério'
            subtitle={`Score geral ${result.score}/100`}
            className='lg:col-span-1'
          >
            <div className='space-y-3'>
              {result.criteriaScores.map((criterion, i) => (
                <div key={criterion.id}>
                  <div className='mb-1 flex justify-between text-[11px]'>
                    <span className='text-muted-foreground'>{criterion.label}</span>
                    <span className='font-bold'>{criterion.score}/5</span>
                  </div>
                  <div className='h-[6px] overflow-hidden rounded-full bg-muted/80'>
                    <div
                      className={`h-full rounded-full ${BAR_COLORS[i % BAR_COLORS.length]}`}
                      style={{ width: `${(criterion.score / 5) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </BentoCard>

          {marketAnalysis.comparables.length > 0 && (
            <BentoCard
              title='Imóveis comparáveis'
              subtitle={`${marketAnalysis.comparables.length} referências de mercado`}
              className='lg:col-span-2'
              showMenu
            >
              <div className='space-y-2'>
                {marketAnalysis.comparables.map((item, i) => (
                  <div
                    key={i}
                    className='group flex items-start justify-between gap-3 rounded-2xl border border-black/[0.04] bg-muted/25 p-3.5 transition-colors hover:bg-muted/50'
                  >
                    <div className='min-w-0'>
                      <p className='truncate text-[13px] font-medium leading-snug'>
                        {item.title}
                      </p>
                      <p className='mt-0.5 text-base font-bold text-flux-dark'>
                        {item.price}
                      </p>
                      {item.area && (
                        <p className='text-[11px] text-muted-foreground'>{item.area}</p>
                      )}
                    </div>
                    {item.link && (
                      <a
                        href={item.link}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='shrink-0 rounded-full p-1.5 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:bg-background hover:text-foreground'
                      >
                        <ExternalLink className='size-3.5' />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </BentoCard>
          )}

          <BentoCard
            title='Insights da IA'
            subtitle={`${result.aiInsights.length} conclusões`}
            className='lg:col-span-2'
            showMenu
          >
            <ul className='space-y-2'>
              {result.aiInsights.map((insight, i) => (
                <li
                  key={i}
                  className='rounded-2xl bg-muted/35 px-3.5 py-2.5 text-[13px] leading-relaxed text-foreground/85'
                >
                  {insight}
                </li>
              ))}
            </ul>
          </BentoCard>
        </div>

        {/* Row 3 — Fotos + análise avançada + plano diretor */}
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
          {result.photoCount > 0 && (
            <BentoCard
              title='Fotos analisadas'
              subtitle={`${result.photoCount} imagem(ns)`}
              showMenu
            >
              <div className='grid grid-cols-2 gap-2'>
                {result.photoPreviews.slice(0, 4).map((url, i) => (
                  <div
                    key={url}
                    className='aspect-square overflow-hidden rounded-2xl bg-muted ring-1 ring-black/[0.04]'
                  >
                    <img
                      src={url}
                      alt={`Foto ${i + 1}`}
                      className='size-full object-cover'
                    />
                  </div>
                ))}
              </div>
            </BentoCard>
          )}

          {(result.marketAppreciationAnalysis ||
            result.neighborhoodAnalysis) && (
            <BentoCard
              title='Análise avançada'
              subtitle='Valorização e bairro'
              className='md:col-span-1 lg:col-span-1'
              showMenu
            >
              <div className='space-y-2'>
                {result.neighborhoodAnalysis && (
                  <div className='rounded-2xl bg-muted/35 p-3.5'>
                    <p className='mb-1 flex items-center gap-1.5 text-[11px] font-semibold'>
                      <MapPinned className='size-3.5 text-flux-lavender' />
                      Bairro
                    </p>
                    <p className='text-[12px] leading-relaxed text-muted-foreground'>
                      {result.neighborhoodAnalysis.summary}
                    </p>
                  </div>
                )}
                {result.marketAppreciationAnalysis && (
                  <div className='rounded-2xl bg-muted/35 p-3.5'>
                    <p className='mb-1 flex items-center gap-1.5 text-[11px] font-semibold'>
                      <TrendingUp className='size-3.5 text-flux-dark' />
                      Projeção de valorização
                    </p>
                    <p className='text-[12px] leading-relaxed text-muted-foreground'>
                      {result.marketAppreciationAnalysis.projectionSummary}
                    </p>
                  </div>
                )}
              </div>
            </BentoCard>
          )}

          <BentoCard
            title='Plano Diretor'
            subtitle='Usos e restrições'
            className='md:col-span-1 lg:col-span-1'
            showMenu
          >
            <div className='grid gap-4 sm:grid-cols-2'>
              <div>
                <p className='text-[10px] font-semibold uppercase tracking-wider text-muted-foreground'>
                  Usos permitidos
                </p>
                <ul className='mt-1.5 space-y-0.5'>
                  {(masterPlanAnalysis.allowedUses.length > 0
                    ? masterPlanAnalysis.allowedUses.slice(0, 3)
                    : ['Não identificado']
                  ).map((use, i) => (
                    <li key={i} className='text-[12px] text-foreground/80'>
                      · {use}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className='text-[10px] font-semibold uppercase tracking-wider text-muted-foreground'>
                  Restrições
                </p>
                <ul className='mt-1.5 space-y-0.5'>
                  {(masterPlanAnalysis.restrictions.length > 0
                    ? masterPlanAnalysis.restrictions.slice(0, 3)
                    : ['Nenhuma identificada']
                  ).map((r, i) => (
                    <li key={i} className='text-[12px] text-foreground/80'>
                      · {r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p className='mt-4 border-t border-black/[0.04] pt-3 text-[11px] leading-relaxed text-muted-foreground'>
              {masterPlanAnalysis.summary}
            </p>
          </BentoCard>
        </div>

        {/* NBR 14653 — full width */}
        {result.nbr14653 && (
          <Nbr14653Panel nbr={result.nbr14653} className='col-span-full' />
        )}

        {/* Fontes */}
        {result.sources && (
          <div className='flex flex-wrap items-center gap-2 rounded-2xl bg-muted/30 px-4 py-2.5'>
            <MapPin className='size-3.5 shrink-0 text-muted-foreground' />
            <p className='text-[11px] text-muted-foreground'>
              <span className='font-medium text-foreground/70'>Fontes consultadas:</span>{' '}
              {result.sources.marketResultsCount} mercado ·{' '}
              {result.sources.masterPlanResultsCount} plano diretor
              {result.sources.neighborhoodResultsCount != null && (
                <> · {result.sources.neighborhoodResultsCount} bairro</>
              )}
              {result.sources.appreciationResultsCount != null && (
                <> · {result.sources.appreciationResultsCount} valorização</>
              )}
            </p>
          </div>
        )}
      </div>

      <SaveToCrmDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        property={property}
        result={result}
        mode={isBroker ? 'broker' : 'personal'}
        onSave={handleSaveToCrm}
      />
    </>
  )
}
