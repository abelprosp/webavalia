import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Loader2,
  MapPin,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { getMarketInsights, type MarketInsight } from '@/lib/fox-ai-api'
import { cn } from '@/lib/utils'

const severityStyles: Record<MarketInsight['severity'], string> = {
  info: 'border-blue-500/30 bg-blue-500/5',
  success: 'border-emerald-500/30 bg-emerald-500/5',
  warning: 'border-amber-500/30 bg-amber-500/5',
  critical: 'border-red-500/30 bg-red-500/5',
}

const typeIcons: Record<MarketInsight['type'], typeof TrendingUp> = {
  trend: TrendingUp,
  alert: AlertTriangle,
  opportunity: Sparkles,
  risk: AlertTriangle,
  forecast: BarChart3,
}

function formatCurrency(value: number | null) {
  if (value === null) return '—'
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

const trendLabels = {
  valorizacao: { label: 'Valorização', color: 'text-emerald-600' },
  estavel: { label: 'Estável', color: 'text-blue-600' },
  desvalorizacao: { label: 'Desvalorização', color: 'text-amber-600' },
  indeterminado: { label: 'Indeterminado', color: 'text-muted-foreground' },
} as const

export function MarketInsightsPanel() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['fox-ai', 'market-insights'],
    queryFn: getMarketInsights,
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className='flex items-center justify-center py-12'>
          <Loader2 className='size-6 animate-spin text-muted-foreground' />
        </CardContent>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className='py-8 text-center text-sm text-muted-foreground'>
          Não foi possível carregar os insights de mercado.
        </CardContent>
      </Card>
    )
  }

  const trend = trendLabels[data.appreciationTrend]

  return (
    <div className='space-y-4'>
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <Card>
          <CardHeader className='pb-2'>
            <CardDescription>Valor médio (AVM)</CardDescription>
            <CardTitle className='text-xl'>
              {formatCurrency(data.averageValue)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-xs text-muted-foreground'>
              Baseado em {data.totalEvaluations} avaliação(ões)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardDescription>Valor médio/m²</CardDescription>
            <CardTitle className='text-xl'>
              {formatCurrency(data.averageValuePerSqm)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-xs text-muted-foreground'>
              Estilo HouseCanary AVM
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardDescription>Tendência de mercado</CardDescription>
            <CardTitle className={cn('flex items-center gap-1 text-xl', trend.color)}>
              {data.appreciationTrend === 'valorizacao' ? (
                <ArrowUpRight className='size-5' />
              ) : data.appreciationTrend === 'desvalorizacao' ? (
                <ArrowDownRight className='size-5' />
              ) : (
                <BarChart3 className='size-5' />
              )}
              {trend.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-xs text-muted-foreground'>
              Previsão baseada nas suas avaliações
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardDescription>Este mês</CardDescription>
            <CardTitle className='text-xl'>
              {data.evaluationsThisMonth} avaliações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-xs text-muted-foreground'>
              {data.credits} crédito(s) restante(s)
            </p>
          </CardContent>
        </Card>
      </div>

      {data.topNeighborhoods.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-base'>
              <MapPin className='size-4' />
              Bairros monitorados
            </CardTitle>
            <CardDescription>
              Análise granular por região — como na HouseCanary
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='flex flex-wrap gap-2'>
              {data.topNeighborhoods.map((n) => (
                <Badge key={n.name} variant='secondary' className='gap-1 py-1'>
                  {n.name}
                  <span className='text-muted-foreground'>
                    · {n.count}x
                    {n.avgValue ? ` · ${formatCurrency(n.avgValue)}` : ''}
                  </span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {data.insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-base'>
              <Sparkles className='size-4 text-orange-500' />
              Alertas e oportunidades
            </CardTitle>
            <CardDescription>
              Sinais de risco e oportunidade do seu portfólio
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-3'>
            {data.insights.map((insight) => {
              const Icon = typeIcons[insight.type]
              return (
                <div
                  key={insight.id}
                  className={cn(
                    'rounded-lg border p-3',
                    severityStyles[insight.severity]
                  )}
                >
                  <div className='flex items-start gap-2'>
                    <Icon className='mt-0.5 size-4 shrink-0' />
                    <div>
                      <p className='text-sm font-medium'>{insight.title}</p>
                      <p className='mt-0.5 text-sm text-muted-foreground'>
                        {insight.description}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
