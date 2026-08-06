import { AlertCircle, MapPin, TrendingUp } from 'lucide-react'
import { formatCurrency } from '@/features/avaliacao/data/evaluation-engine'
import { BentoCard, FluxBadge, MetricIcon } from '@/features/avaliacao/components/bento-card'
import type { MarketMapResult } from '@/lib/market-map-api'

type MarketMapResultPanelProps = {
  result: MarketMapResult | null
  error: string | null
  loading?: boolean
}

export function MarketMapResultPanel({
  result,
  error,
  loading,
}: MarketMapResultPanelProps) {
  if (loading) {
    return (
      <BentoCard variant='muted' title='Consultando região' subtitle='Aguarde...'>
        <p className='text-sm text-muted-foreground'>
          Analisando comparáveis de mercado na região selecionada.
        </p>
      </BentoCard>
    )
  }

  if (error) {
    return (
      <BentoCard variant='muted' title='Sem dados na região'>
        <div className='flex items-start gap-3 text-sm text-muted-foreground'>
          <AlertCircle className='mt-0.5 size-4 shrink-0 text-destructive' />
          <p>{error}</p>
        </div>
      </BentoCard>
    )
  }

  if (!result) {
    return (
      <BentoCard
        variant='muted'
        title='Preço por m²'
        subtitle='Selecione um ponto no mapa'
      >
        <p className='text-sm text-muted-foreground'>
          Escolha a cidade e os filtros, depois clique em qualquer ponto do mapa
          para consultar o valor estimado por metro quadrado naquela região.
        </p>
      </BentoCard>
    )
  }

  const isRent = result.listingIntent === 'alugar'

  return (
    <div className='space-y-3'>
      <BentoCard variant='accent' title='Preço por m²' subtitle={result.address}>
        <div className='flex items-center gap-3'>
          <MetricIcon className='bg-flux-dark/10'>
            <TrendingUp className='size-5 text-flux-dark' />
          </MetricIcon>
          <div>
            <p className='text-3xl font-bold tracking-tight'>
              {formatCurrency(result.valuePerSqm)}
              <span className='text-base font-medium opacity-70'>/m²</span>
            </p>
            <p className='mt-1 text-[11px] opacity-70'>
              {isRent
                ? 'Estimativa de aluguel por m²'
                : 'Estimativa NBR 14653 por m²'}
            </p>
          </div>
        </div>
      </BentoCard>

      {result.showTotalValue && result.estimatedTotalValue != null && (
        <BentoCard variant='default' title='Valor total estimado'>
          <p className='text-2xl font-bold tracking-tight'>
            {formatCurrency(result.estimatedTotalValue)}
          </p>
          <p className='mt-1 text-[11px] text-muted-foreground'>
            Com base na metragem informada nos filtros
          </p>
        </BentoCard>
      )}

      <BentoCard variant='default' title='Confiança da estimativa'>
        <div className='flex flex-wrap items-center gap-2'>
          <FluxBadge variant='lavender'>{result.scoreLabel}</FluxBadge>
          <span className='text-xs text-muted-foreground'>
            Score {result.score}/100 · {result.comparablesCount} comparáve
            {result.comparablesCount === 1 ? 'l' : 'is'}
          </span>
        </div>
        {result.priceRange && (
          <p className='mt-3 text-sm text-muted-foreground'>
            Faixa por m²: {formatCurrency(result.priceRange.min)} —{' '}
            {formatCurrency(result.priceRange.max)}/m²
          </p>
        )}
      </BentoCard>

      {result.neighborhood && (
        <BentoCard variant='muted' title='Região identificada'>
          <div className='flex items-center gap-2 text-sm'>
            <MapPin className='size-4 text-flux-lavender' />
            <span>{result.neighborhood}</span>
          </div>
        </BentoCard>
      )}
    </div>
  )
}
