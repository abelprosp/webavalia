import { useState } from 'react'
import {
  TrendingUp,
  MapPin,
  ExternalLink,
  Landmark,
  FileDown,
  Loader2,
  BookmarkPlus,
  Droplets,
  MapPinned,
} from 'lucide-react'
import { toast } from 'sonner'
import { useCrmStore } from '@/stores/crm-store'
import {
  CrmSavedToastAction,
  SaveToCrmDialog,
} from '@/features/crm/components/save-to-crm-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  getFinishLevelLabel,
  getFurnishingLabel,
  getStandardLevelLabel,
} from '../data/criteria'
import {
  formatCurrency,
  type EvaluationFormValues,
  type EvaluationResult,
} from '../data/evaluation-engine'
import { exportEvaluationPdf } from '../lib/export-evaluation-pdf'
import { Nbr14653Panel } from './nbr-14653-panel'
import { BentoCard, FluxBadge } from './bento-card'

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
    <div className='relative mx-auto my-4 flex h-36 w-full max-w-[220px] items-center justify-center'>
      <div
        className='absolute left-1/2 top-1/2 flex size-24 -translate-x-[65%] -translate-y-1/2 flex-col items-center justify-center rounded-full bg-flux-lavender/80 text-flux-dark'
        style={{ zIndex: 1 }}
      >
        <span className='text-[10px] font-medium opacity-70'>Localização</span>
        <span className='text-xs font-bold'>{formatCurrency(locVal)}</span>
      </div>
      <div
        className='absolute left-1/2 top-1/2 flex size-20 -translate-x-[20%] -translate-y-[55%] flex-col items-center justify-center rounded-full bg-flux-dark text-white'
        style={{ zIndex: 2 }}
      >
        <span className='text-[10px] font-medium opacity-70'>Construção</span>
        <span className='text-xs font-bold'>{formatCurrency(conVal)}</span>
      </div>
      <div
        className='absolute left-1/2 top-1/2 flex size-16 -translate-x-[10%] -translate-y-[15%] flex-col items-center justify-center rounded-full bg-flux-lime text-flux-dark'
        style={{ zIndex: 3 }}
      >
        <span className='text-[9px] font-medium opacity-70'>Mercado</span>
        <span className='text-[10px] font-bold'>{formatCurrency(mktVal)}</span>
      </div>
    </div>
  )
}

function DotMatrix({ filled, total = 25 }: { filled: number; total?: number }) {
  return (
    <div className='grid grid-cols-5 gap-1.5'>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`size-2.5 rounded-full ${
            i < filled ? 'bg-flux-lavender' : 'bg-muted'
          }`}
        />
      ))}
    </div>
  )
}

function CriteriaBars({
  criteria,
  dark = false,
}: {
  criteria: EvaluationResult['criteriaScores']
  dark?: boolean
}) {
  const colors = ['bg-flux-lavender', 'bg-flux-dark', 'bg-flux-lime']
  return (
    <div className='space-y-2.5'>
      {criteria.slice(0, 3).map((c, i) => (
        <div key={c.id}>
          <div className='mb-1 flex justify-between text-xs'>
            <span className={dark ? 'text-white/70' : 'text-muted-foreground'}>
              {c.label}
            </span>
            <span className={dark ? 'font-medium text-white' : 'font-medium'}>
              {Math.round((c.score / 5) * 100)}%
            </span>
          </div>
          <div
            className={`h-2 overflow-hidden rounded-full ${dark ? 'bg-white/10' : 'bg-muted'}`}
          >
            <div
              className={`h-full rounded-full ${colors[i % colors.length]}`}
              style={{ width: `${(c.score / 5) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function AppreciationBars({ factors }: { factors: string[] }) {
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul']
  const heights = [40, 55, 45, 60, 50, 70, 85]
  return (
    <div className='mt-auto flex items-end justify-between gap-1 pt-4'>
      {months.map((month, i) => {
        const isActive = i === months.length - 1
        return (
          <div key={month} className='flex flex-1 flex-col items-center gap-1'>
            <div
              className='flex w-full items-end justify-center gap-0.5'
              style={{ height: 64 }}
            >
              {isActive ? (
                <>
                  <div
                    className='w-2 rounded-t-full bg-flux-lime'
                    style={{ height: `${heights[i]}%` }}
                  />
                  <div
                    className='w-2 rounded-t-full bg-flux-lavender'
                    style={{ height: `${heights[i] * 0.7}%` }}
                  />
                </>
              ) : (
                <div
                  className='w-full rounded-t-md bg-white/10'
                  style={{
                    height: `${heights[i]}%`,
                    backgroundImage:
                      'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.05) 2px, rgba(255,255,255,0.05) 4px)',
                  }}
                />
              )}
            </div>
            <span className='text-[10px] text-white/40'>{month}</span>
          </div>
        )
      })}
      {factors.length > 0 && (
        <p className='sr-only'>Fatores: {factors.join(', ')}</p>
      )}
    </div>
  )
}

export function EvaluationResultPanel({
  result,
  property,
}: EvaluationResultPanelProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const saveEvaluation = useCrmStore((s) => s.saveEvaluation)
  const { marketAnalysis, masterPlanAnalysis } = result
  const propertyHighlights = getPropertyHighlights(property)

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
    toast.success('Avaliação salva no CRM!', {
      action: <CrmSavedToastAction />,
    })
  }

  return (
    <>
      <div className='space-y-4'>
        {/* Header */}
        <div className='flex flex-wrap items-end justify-between gap-4'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>
              Visão da avaliação
            </h2>
            <p className='text-sm text-muted-foreground'>
              {property.address} ·{' '}
              {result.evaluatedAt.toLocaleString('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </p>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <Button
              variant='outline'
              size='sm'
              className='rounded-full'
              onClick={() => setSaveDialogOpen(true)}
            >
              <BookmarkPlus className='size-4' />
              Salvar no CRM
            </Button>
            <Button
              variant='outline'
              size='sm'
              className='rounded-full'
              onClick={handleExportPdf}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className='size-4 animate-spin' />
              ) : (
                <FileDown className='size-4' />
              )}
              Exportar PDF
            </Button>
            <FluxBadge>{result.scoreLabel}</FluxBadge>
          </div>
        </div>

        {/* Bento Grid */}
        <div className='grid auto-rows-min grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4'>
          {/* Hero — Valor estimado */}
          <BentoCard
            title='Valor estimado'
            subtitle='Determinação de mercado (NBR 14653)'
            className='md:col-span-1 xl:col-span-1 xl:row-span-2'
          >
            <div className='flex items-start justify-between gap-2'>
              <div>
                <p className='text-3xl font-bold tracking-tight'>
                  {formatCurrency(result.estimatedValue)}
                </p>
                <p className='mt-1 text-sm text-muted-foreground'>
                  {formatCurrency(result.valuePerSqm)}/m²
                </p>
              </div>
              {growthPct != null && (
                <FluxBadge>
                  {growthPct > 0 ? '+' : ''}
                  {growthPct}%
                </FluxBadge>
              )}
            </div>

            <ValueBreakdownCircles
              total={result.estimatedValue}
              location={locationScore}
              construction={conditionScore}
              market={marketScore}
            />

            <CriteriaBars criteria={result.criteriaScores} />

            {propertyHighlights.length > 0 && (
              <div className='mt-4 flex flex-wrap gap-1.5'>
                {propertyHighlights.map((h) => (
                  <Badge key={h} variant='secondary' className='rounded-full text-xs'>
                    {h}
                  </Badge>
                ))}
              </div>
            )}
          </BentoCard>

          {/* Mercado */}
          <BentoCard title='Mercado local' subtitle='Comparáveis e faixa de preços'>
            <div className='flex items-end justify-between'>
              <div>
                <p className='text-2xl font-bold'>
                  {marketAnalysis.averagePricePerSqm != null
                    ? formatCurrency(marketAnalysis.averagePricePerSqm)
                    : '—'}
                </p>
                <p className='text-xs text-muted-foreground'>média / m²</p>
              </div>
              <div className='text-right'>
                <p className='text-lg font-semibold text-muted-foreground'>
                  {marketAnalysis.comparables.length}
                </p>
                <p className='text-xs text-muted-foreground'>comparáveis</p>
              </div>
            </div>
            {marketAnalysis.priceRange && (
              <p className='mt-3 text-xs text-muted-foreground'>
                Faixa: {formatCurrency(marketAnalysis.priceRange.min)} –{' '}
                {formatCurrency(marketAnalysis.priceRange.max)}
              </p>
            )}
            <p className='mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground'>
              {marketAnalysis.summary}
            </p>
          </BentoCard>

          {/* Zoneamento */}
          <BentoCard title='Zoneamento' subtitle='Plano Diretor'>
            <div className='flex items-end justify-between'>
              <div>
                <p className='text-lg font-bold leading-tight'>
                  {masterPlanAnalysis.zoning.slice(0, 40)}
                  {masterPlanAnalysis.zoning.length > 40 ? '…' : ''}
                </p>
                <p className='mt-1 text-xs text-muted-foreground'>
                  {masterPlanAnalysis.allowedUses.length} usos permitidos
                </p>
              </div>
              <Landmark className='size-8 text-flux-lavender opacity-60' />
            </div>
            <p className='mt-3 line-clamp-2 text-xs text-muted-foreground'>
              {masterPlanAnalysis.developmentPotential}
            </p>
          </BentoCard>

          {/* Enchentes */}
          {result.floodRiskAnalysis && (
            <BentoCard title='Risco hídrico' subtitle='Histórico de enchentes'>
              <div className='flex items-end justify-between'>
                <div>
                  <p className='text-2xl font-bold capitalize'>
                    {result.floodRiskAnalysis.riskLevelLabel}
                  </p>
                  <p className='text-xs text-muted-foreground'>
                    {result.floodRiskAnalysis.historicalEvents.length} evento(s)
                  </p>
                </div>
                <Droplets className='size-8 text-blue-400 opacity-60' />
              </div>
              <p className='mt-2 line-clamp-2 text-xs text-muted-foreground'>
                {result.floodRiskAnalysis.summary}
              </p>
            </BentoCard>
          )}

          {/* Score do bairro */}
          <BentoCard title='Score do bairro' subtitle='Localização e infraestrutura'>
            <div className='flex items-start justify-between'>
              <div>
                <p className='text-3xl font-bold'>
                  {Math.round((locationScore / 5) * 100)}%
                </p>
                <FluxBadge className='mt-1'>+{locationScore * 4}%</FluxBadge>
              </div>
            </div>
            <div className='mt-4'>
              <DotMatrix filled={neighborhoodDots} />
            </div>
          </BentoCard>

          {/* Valorização */}
          {result.marketAppreciationAnalysis && (
            <BentoCard title='Valorização' subtitle='Tendência de mercado'>
              <div className='flex items-end justify-between'>
                <div>
                  <p className='text-xl font-bold'>
                    {result.marketAppreciationAnalysis.trendLabel}
                  </p>
                  {result.marketAppreciationAnalysis.annualGrowthEstimatePercent != null && (
                    <FluxBadge className='mt-1'>
                      {result.marketAppreciationAnalysis.annualGrowthEstimatePercent > 0
                        ? '+'
                        : ''}
                      {result.marketAppreciationAnalysis.annualGrowthEstimatePercent}%/ano
                    </FluxBadge>
                  )}
                </div>
                <TrendingUp className='size-8 text-flux-lime opacity-80' />
              </div>
              <p className='mt-2 line-clamp-2 text-xs text-muted-foreground'>
                {result.marketAppreciationAnalysis.liquidity}
              </p>
            </BentoCard>
          )}

          {/* Bairro — dark card (Sleep Analysis style) */}
          {result.neighborhoodAnalysis && (
            <BentoCard
              variant='dark'
              title='Pesquisa avançada do bairro'
              subtitle={result.neighborhoodAnalysis.qualityOfLife.slice(0, 60)}
              className='md:col-span-2 xl:col-span-2'
            >
              <div className='grid gap-4 sm:grid-cols-2'>
                <div>
                  <p className='text-xs text-white/50'>Segurança percebida</p>
                  <p className='text-lg font-semibold'>
                    {result.neighborhoodAnalysis.safetyPerception.slice(0, 50)}
                  </p>
                </div>
                <div>
                  <p className='text-xs text-white/50'>Demanda / liquidez</p>
                  <p className='text-lg font-semibold'>
                    {result.marketAppreciationAnalysis?.demandLevel?.slice(0, 50) ??
                      'Alta demanda regional'}
                  </p>
                </div>
              </div>
              <p className='mt-2 line-clamp-2 text-sm text-white/70'>
                {result.neighborhoodAnalysis.overview}
              </p>
              <AppreciationBars
                factors={
                  result.marketAppreciationAnalysis?.priceTrendFactors ?? []
                }
              />
            </BentoCard>
          )}

          {/* Critérios completos */}
          <BentoCard
            title='Pontuação por critério'
            subtitle={`Score geral ${result.score}/100`}
            className='md:col-span-1 xl:col-span-1'
          >
            <div className='space-y-3'>
              {result.criteriaScores.map((criterion) => (
                <div key={criterion.id} className='space-y-1'>
                  <div className='flex justify-between text-xs'>
                    <span className='text-muted-foreground'>{criterion.label}</span>
                    <span className='font-semibold'>{criterion.score}/5</span>
                  </div>
                  <div className='h-1.5 overflow-hidden rounded-full bg-muted'>
                    <div
                      className='h-full rounded-full bg-flux-lime'
                      style={{ width: `${(criterion.score / 5) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </BentoCard>

          {/* Comparáveis */}
          {marketAnalysis.comparables.length > 0 && (
            <BentoCard
              title='Imóveis comparáveis'
              subtitle={`${marketAnalysis.comparables.length} referências de mercado`}
              className='md:col-span-2 xl:col-span-2'
            >
              <div className='max-h-48 space-y-2 overflow-y-auto pr-1'>
                {marketAnalysis.comparables.map((item, i) => (
                  <div
                    key={i}
                    className='flex items-start justify-between gap-2 rounded-2xl bg-muted/40 p-3 text-sm'
                  >
                    <div className='min-w-0'>
                      <p className='truncate font-medium'>{item.title}</p>
                      <p className='font-semibold text-flux-dark'>{item.price}</p>
                      {item.area && (
                        <p className='text-xs text-muted-foreground'>{item.area}</p>
                      )}
                    </div>
                    {item.link && (
                      <a
                        href={item.link}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='shrink-0 text-muted-foreground hover:text-foreground'
                      >
                        <ExternalLink className='size-4' />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </BentoCard>
          )}

          {/* Insights */}
          <BentoCard
            title='Insights da IA'
            subtitle={`${result.aiInsights.length} conclusões`}
            className='md:col-span-2 xl:col-span-2'
          >
            <ul className='space-y-2'>
              {result.aiInsights.map((insight, i) => (
                <li
                  key={i}
                  className='rounded-2xl bg-muted/40 px-3 py-2 text-sm leading-relaxed'
                >
                  {insight}
                </li>
              ))}
            </ul>
          </BentoCard>

          {/* Fotos */}
          {result.photoCount > 0 && (
            <BentoCard
              title={`Fotos analisadas`}
              subtitle={`${result.photoCount} imagem(ns)`}
              className='md:col-span-1'
            >
              <div className='grid grid-cols-2 gap-2'>
                {result.photoPreviews.slice(0, 4).map((url, i) => (
                  <div
                    key={url}
                    className='aspect-square overflow-hidden rounded-2xl bg-muted'
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

          {/* Detalhes avançados — enchentes + valorização expandidos */}
          {(result.floodRiskAnalysis || result.marketAppreciationAnalysis) && (
            <BentoCard
              title='Análise avançada'
              subtitle='Enchentes, valorização e bairro'
              className='md:col-span-2 xl:col-span-2'
            >
              <div className='grid gap-4 sm:grid-cols-2'>
                {result.floodRiskAnalysis && (
                  <div className='rounded-2xl bg-muted/30 p-3'>
                    <p className='mb-1 flex items-center gap-1.5 text-xs font-semibold'>
                      <Droplets className='size-3.5' />
                      Risco hídrico
                    </p>
                    <p className='text-sm leading-relaxed text-muted-foreground'>
                      {result.floodRiskAnalysis.impactOnValue}
                    </p>
                  </div>
                )}
                {result.neighborhoodAnalysis && (
                  <div className='rounded-2xl bg-muted/30 p-3'>
                    <p className='mb-1 flex items-center gap-1.5 text-xs font-semibold'>
                      <MapPinned className='size-3.5' />
                      Bairro
                    </p>
                    <p className='text-sm leading-relaxed text-muted-foreground'>
                      {result.neighborhoodAnalysis.summary}
                    </p>
                  </div>
                )}
                {result.marketAppreciationAnalysis && (
                  <div className='rounded-2xl bg-muted/30 p-3 sm:col-span-2'>
                    <p className='mb-1 flex items-center gap-1.5 text-xs font-semibold'>
                      <TrendingUp className='size-3.5' />
                      Projeção de valorização
                    </p>
                    <p className='text-sm leading-relaxed text-muted-foreground'>
                      {result.marketAppreciationAnalysis.projectionSummary}
                    </p>
                  </div>
                )}
              </div>
            </BentoCard>
          )}

          {/* Zoneamento detalhado */}
          <BentoCard
            title='Plano Diretor'
            subtitle='Usos e restrições'
            className='md:col-span-2'
          >
            <div className='grid gap-3 sm:grid-cols-2 text-sm'>
              <div>
                <p className='text-xs font-medium text-muted-foreground'>Usos permitidos</p>
                <ul className='mt-1 list-inside list-disc space-y-0.5 text-xs'>
                  {(masterPlanAnalysis.allowedUses.length > 0
                    ? masterPlanAnalysis.allowedUses.slice(0, 4)
                    : ['Não identificado']
                  ).map((use, i) => (
                    <li key={i}>{use}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className='text-xs font-medium text-muted-foreground'>Restrições</p>
                <ul className='mt-1 list-inside list-disc space-y-0.5 text-xs'>
                  {(masterPlanAnalysis.restrictions.length > 0
                    ? masterPlanAnalysis.restrictions.slice(0, 4)
                    : ['Nenhuma identificada']
                  ).map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            </div>
            <p className='mt-3 border-t pt-3 text-xs leading-relaxed text-muted-foreground'>
              {masterPlanAnalysis.summary}
            </p>
          </BentoCard>
        </div>

        {/* NBR 14653 */}
        {result.nbr14653 && (
          <div className='mt-2'>
            <Nbr14653Panel nbr={result.nbr14653} />
          </div>
        )}

        {/* Fontes */}
        {result.sources && (
          <p className='flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground'>
            <MapPin className='size-3 shrink-0' />
            Fontes: {result.sources.marketResultsCount} mercado ·{' '}
            {result.sources.masterPlanResultsCount} plano diretor
            {result.sources.neighborhoodResultsCount != null && (
              <> · {result.sources.neighborhoodResultsCount} bairro</>
            )}
            {result.sources.floodResultsCount != null && (
              <> · {result.sources.floodResultsCount} enchentes</>
            )}
            {result.sources.appreciationResultsCount != null && (
              <> · {result.sources.appreciationResultsCount} valorização</>
            )}
          </p>
        )}
      </div>

      <SaveToCrmDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        property={property}
        result={result}
        onSave={handleSaveToCrm}
      />
    </>
  )
}
