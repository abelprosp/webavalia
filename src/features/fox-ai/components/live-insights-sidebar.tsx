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
import { getMarketInsights, type MarketInsight } from '@/lib/fox-ai-api'
import { FOX_AI_QUERY_META } from '@/lib/query-meta'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'

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

const trendLabels = {
  valorizacao: { label: 'Valorização', color: 'text-emerald-600' },
  estavel: { label: 'Estável', color: 'text-blue-600' },
  desvalorizacao: { label: 'Desvalorização', color: 'text-amber-600' },
  indeterminado: { label: 'Indeterminado', color: 'text-muted-foreground' },
} as const

function formatCurrency(value: number | null) {
  if (value === null) return '—'
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

export function LiveInsightsSidebar() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['fox-ai', 'market-insights'],
    queryFn: getMarketInsights,
    staleTime: 60_000,
    meta: FOX_AI_QUERY_META,
  })

  if (isLoading) {
    return (
      <Card className='h-full'>
        <CardContent className='flex items-center justify-center py-16'>
          <Loader2 className='size-6 animate-spin text-muted-foreground' />
        </CardContent>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Card className='h-full'>
        <CardContent className='py-8 text-center text-sm text-muted-foreground'>
          Insights indisponíveis
        </CardContent>
      </Card>
    )
  }

  const trend = trendLabels[data.appreciationTrend] ?? trendLabels.indeterminado

  return (
    <Card className='flex h-full flex-col'>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2 text-base'>
          <Sparkles className='size-4 text-orange-500' />
          Insights ao vivo
        </CardTitle>
        <CardDescription>Portfólio e mercado em tempo real</CardDescription>
      </CardHeader>
      <CardContent className='flex-1 overflow-hidden p-0'>
        <ScrollArea className='h-[min(70vh,600px)] px-6 pb-6'>
          <div className='space-y-4'>
            <div className='grid grid-cols-2 gap-2'>
              <MetricBox
                label='Valor médio'
                value={formatCurrency(data.averageValue)}
              />
              <MetricBox
                label='Valor/m²'
                value={formatCurrency(data.averageValuePerSqm)}
              />
              <MetricBox
                label='Este mês'
                value={`${data.evaluationsThisMonth}`}
                sub='avaliações'
              />
              <MetricBox label='Créditos' value={`${data.credits}`} />
            </div>

            <div className='rounded-lg border p-3'>
              <p className='text-xs text-muted-foreground'>Tendência</p>
              <p
                className={cn(
                  'flex items-center gap-1 font-semibold',
                  trend.color
                )}
              >
                {data.appreciationTrend === 'valorizacao' ? (
                  <ArrowUpRight className='size-4' />
                ) : data.appreciationTrend === 'desvalorizacao' ? (
                  <ArrowDownRight className='size-4' />
                ) : (
                  <BarChart3 className='size-4' />
                )}
                {trend.label}
              </p>
            </div>

            {data.topNeighborhoods.length > 0 && (
              <div>
                <p className='mb-2 flex items-center gap-1 text-xs font-medium text-muted-foreground'>
                  <MapPin className='size-3' />
                  Bairros monitorados
                </p>
                <div className='flex flex-wrap gap-1.5'>
                  {data.topNeighborhoods.map((n) => (
                    <Badge key={n.name} variant='secondary' className='text-xs'>
                      {n.name} · {n.count}x
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {data.insights.length > 0 && (
              <div className='space-y-2'>
                <p className='text-xs font-medium text-muted-foreground'>
                  Alertas e oportunidades
                </p>
                {data.insights.map((insight) => {
                  const Icon = typeIcons[insight.type] ?? Sparkles
                  return (
                    <div
                      key={insight.id}
                      className={cn(
                        'rounded-lg border p-2.5',
                        severityStyles[insight.severity]
                      )}
                    >
                      <div className='flex items-start gap-2'>
                        <Icon className='mt-0.5 size-3.5 shrink-0' />
                        <div>
                          <p className='text-xs font-medium'>{insight.title}</p>
                          <p className='mt-0.5 text-xs text-muted-foreground'>
                            {insight.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

function MetricBox({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className='rounded-lg border p-2.5'>
      <p className='text-[10px] text-muted-foreground'>{label}</p>
      <p className='text-sm font-semibold'>{value}</p>
      {sub && <p className='text-[10px] text-muted-foreground'>{sub}</p>}
    </div>
  )
}
