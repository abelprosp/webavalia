import {
  AlertTriangle,
  CheckCircle2,
  MapPinned,
  TrendingUp,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type {
  MarketAppreciationAnalysis,
  NeighborhoodAnalysis,
} from '../data/evaluation-engine'

type AdvancedAnalysisPanelProps = {
  neighborhood?: NeighborhoodAnalysis
  appreciation?: MarketAppreciationAnalysis
}

function getAppreciationBadgeClass(trend: MarketAppreciationAnalysis['trend']) {
  switch (trend) {
    case 'valorizacao':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
    case 'desvalorizacao':
      return 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
    case 'estavel':
      return 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300'
    default:
      return ''
  }
}

function BulletSection({
  title,
  items,
  emptyLabel,
}: {
  title: string
  items: string[]
  emptyLabel?: string
}) {
  if (items.length === 0 && !emptyLabel) return null

  return (
    <div>
      <p className='text-xs font-medium text-muted-foreground'>{title}</p>
      <ul className='mt-1 list-inside list-disc space-y-0.5'>
        {items.length > 0 ? (
          items.map((item, i) => <li key={i}>{item}</li>)
        ) : (
          <li>{emptyLabel}</li>
        )}
      </ul>
    </div>
  )
}

export function AdvancedAnalysisPanel({
  neighborhood,
  appreciation,
}: AdvancedAnalysisPanelProps) {
  if (!neighborhood && !appreciation) return null

  return (
    <div className='space-y-6'>
      {neighborhood && (
        <div>
          <h4 className='mb-3 flex items-center gap-2 text-sm font-medium'>
            <MapPinned className='size-4' />
            Pesquisa avançada do bairro
          </h4>
          <div className='space-y-4 rounded-lg border bg-muted/20 p-4 text-sm'>
            <p className='leading-relaxed'>{neighborhood.overview}</p>
            <BulletSection
              title='Infraestrutura'
              items={neighborhood.infrastructure}
            />
            <BulletSection title='Serviços' items={neighborhood.services} />
            <BulletSection title='Mobilidade' items={neighborhood.mobility} />
            <div>
              <p className='text-xs font-medium text-muted-foreground'>
                Segurança percebida
              </p>
              <p className='mt-0.5'>{neighborhood.safetyPerception}</p>
            </div>
            <div>
              <p className='text-xs font-medium text-muted-foreground'>
                Qualidade de vida
              </p>
              <p className='mt-0.5'>{neighborhood.qualityOfLife}</p>
            </div>
            {neighborhood.highlights.length > 0 && (
              <div>
                <p className='mb-2 flex items-center gap-1 text-xs font-medium text-muted-foreground'>
                  <CheckCircle2 className='size-3.5 text-emerald-600' />
                  Destaques
                </p>
                <div className='flex flex-wrap gap-2'>
                  {neighborhood.highlights.map((item) => (
                    <Badge key={item} variant='outline' className='text-xs'>
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {neighborhood.concerns.length > 0 && (
              <div>
                <p className='mb-2 flex items-center gap-1 text-xs font-medium text-muted-foreground'>
                  <AlertTriangle className='size-3.5 text-amber-600' />
                  Pontos de atenção
                </p>
                <ul className='list-inside list-disc space-y-0.5 text-muted-foreground'>
                  {neighborhood.concerns.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className='border-t pt-3 leading-relaxed text-muted-foreground'>
              {neighborhood.summary}
            </p>
          </div>
        </div>
      )}

      {appreciation && (
        <div>
          <h4 className='mb-3 flex items-center gap-2 text-sm font-medium'>
            <TrendingUp className='size-4' />
            Valorização e tendência de mercado
          </h4>
          <div className='space-y-4 rounded-lg border bg-muted/20 p-4 text-sm'>
            <div className='flex flex-wrap items-center gap-2'>
              <Badge
                variant='outline'
                className={getAppreciationBadgeClass(appreciation.trend)}
              >
                {appreciation.trendLabel}
              </Badge>
              {appreciation.annualGrowthEstimatePercent != null && (
                <Badge variant='secondary' className='text-xs'>
                  Crescimento estimado:{' '}
                  {appreciation.annualGrowthEstimatePercent > 0 ? '+' : ''}
                  {appreciation.annualGrowthEstimatePercent}%/ano
                </Badge>
              )}
            </div>
            <p className='leading-relaxed'>{appreciation.historicalContext}</p>
            <div className='grid gap-3 sm:grid-cols-2'>
              <div>
                <p className='text-xs font-medium text-muted-foreground'>
                  Demanda
                </p>
                <p className='mt-0.5'>{appreciation.demandLevel}</p>
              </div>
              <div>
                <p className='text-xs font-medium text-muted-foreground'>
                  Liquidez
                </p>
                <p className='mt-0.5'>{appreciation.liquidity}</p>
              </div>
            </div>
            <BulletSection
              title='Fatores de tendência de preços'
              items={appreciation.priceTrendFactors}
            />
            <div>
              <p className='text-xs font-medium text-muted-foreground'>
                Projeção
              </p>
              <p className='mt-0.5'>{appreciation.projectionSummary}</p>
            </div>
            <p className='border-t pt-3 leading-relaxed text-muted-foreground'>
              {appreciation.summary}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
