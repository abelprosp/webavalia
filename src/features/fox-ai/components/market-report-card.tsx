import { useMutation } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Loader2,
  Minus,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { generateMarketReport, type MarketReport } from '@/lib/fox-ai-api'
import { cn } from '@/lib/utils'

const directionIcons = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  stable: Minus,
} as const

type TrendDirection = keyof typeof directionIcons

const directionColors: Record<TrendDirection, string> = {
  up: 'text-emerald-600',
  down: 'text-amber-600',
  stable: 'text-blue-600',
}

function resolveTrendDirection(value: string): TrendDirection {
  return value in directionIcons ? (value as TrendDirection) : 'stable'
}

const severityStyles = {
  low: 'border-blue-500/30 bg-blue-500/5',
  medium: 'border-amber-500/30 bg-amber-500/5',
  high: 'border-red-500/30 bg-red-500/5',
} as const

const CHART_COLORS = [
  'bg-orange-500',
  'bg-blue-500',
  'bg-emerald-500',
  'bg-violet-500',
] as const

export function MarketReportCard() {
  const mutation = useMutation({
    mutationFn: generateMarketReport,
  })

  const report = mutation.data

  return (
    <Card className='border-orange-500/20'>
      <CardHeader>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div>
            <CardTitle className='flex items-center gap-2 text-base'>
              <BarChart3 className='size-5 text-orange-500' />
              Relatório de mercado
            </CardTitle>
            <CardDescription>
              Análise estruturada com tendências, riscos e oportunidades
            </CardDescription>
          </div>
          <Button
            variant='outline'
            size='sm'
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className='border-orange-500/30'
          >
            {mutation.isPending ? (
              <Loader2 className='me-1 size-4 animate-spin' />
            ) : (
              <RefreshCw className='me-1 size-4' />
            )}
            {report ? 'Atualizar' : 'Gerar relatório'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {mutation.isError && (
          <p className='text-sm text-destructive'>
            {mutation.error instanceof AxiosError &&
            typeof mutation.error.response?.data?.message === 'string'
              ? mutation.error.response.data.message
              : 'Erro ao gerar relatório.'}
          </p>
        )}

        {!report && !mutation.isPending && !mutation.isError && (
          <p className='text-sm text-muted-foreground'>
            Gere um relatório completo com base no seu histórico de avaliações.
          </p>
        )}

        {mutation.isPending && (
          <div className='flex items-center gap-2 py-8 text-sm text-muted-foreground'>
            <Loader2 className='size-4 animate-spin text-orange-500' />
            FoxAi está compilando seu relatório de mercado...
          </div>
        )}

        {report && <ReportContent report={report} />}
      </CardContent>
    </Card>
  )
}

function ReportContent({ report }: { report: MarketReport }) {
  const chartData = report.metrics.map((m, i) => ({
    name: m.label,
    value: parseMetricValue(m.value),
    display: m.value,
    barClass: CHART_COLORS[i % CHART_COLORS.length],
  }))
  const maxValue = Math.max(...chartData.map((d) => d.value), 0)

  return (
    <div className='space-y-4'>
      <div className='rounded-lg border bg-muted/30 p-4'>
        <p className='text-sm font-medium'>{report.summary}</p>
        <p className='mt-1 text-xs text-muted-foreground'>
          Gerado em {new Date(report.generatedAt).toLocaleString('pt-BR')}
        </p>
      </div>

      {chartData.some((d) => d.value > 0) && (
        <div className='space-y-2.5'>
          {chartData.map((entry) => (
            <div key={entry.name} className='grid grid-cols-[90px_1fr_auto] items-center gap-2'>
              <span className='truncate text-xs text-muted-foreground'>
                {entry.name}
              </span>
              <div className='h-2 overflow-hidden rounded-full bg-muted'>
                <div
                  className={cn('h-full rounded-full transition-all', entry.barClass)}
                  style={{
                    width: `${maxValue > 0 ? (entry.value / maxValue) * 100 : 0}%`,
                  }}
                />
              </div>
              <span className='text-xs font-medium tabular-nums'>{entry.display}</span>
            </div>
          ))}
        </div>
      )}

      {report.trends.length > 0 && (
        <div>
          <p className='mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
            Tendências
          </p>
          <div className='space-y-2'>
            {report.trends.map((trend, i) => {
              const direction = resolveTrendDirection(trend.direction)
              const Icon = directionIcons[direction]
              return (
                <div key={i} className='flex items-start gap-2 rounded-lg border p-3'>
                  <Icon
                    className={cn('mt-0.5 size-4', directionColors[direction])}
                  />
                  <div>
                    <p className='text-sm font-medium'>{trend.title}</p>
                    <p className='text-xs text-muted-foreground'>
                      {trend.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {report.risks.length > 0 && (
        <div>
          <p className='mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
            Riscos
          </p>
          <div className='space-y-2'>
            {report.risks.map((r, i) => (
              <div
                key={i}
                className={cn(
                  'rounded-lg border p-3',
                  severityStyles[r.severity] ?? severityStyles.medium
                )}
              >
                <p className='text-sm font-medium'>{r.title}</p>
                <p className='text-xs text-muted-foreground'>{r.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {report.opportunities.length > 0 && (
        <div>
          <p className='mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
            Oportunidades
          </p>
          <div className='space-y-2'>
            {report.opportunities.map((o, i) => (
              <div key={i} className='rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3'>
                <div className='flex items-start justify-between gap-2'>
                  <div>
                    <p className='text-sm font-medium'>{o.title}</p>
                    <p className='text-xs text-muted-foreground'>{o.description}</p>
                  </div>
                  <Badge variant='outline' className='shrink-0 text-xs'>
                    <Sparkles className='me-1 size-3' />
                    {o.action}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className='rounded-lg border p-3'>
        <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
          Previsão — {report.forecast.period}
        </p>
        <p className='mt-1 text-sm'>{report.forecast.outlook}</p>
        <div className='mt-2 flex items-center gap-2'>
          <div className='h-1.5 flex-1 overflow-hidden rounded-full bg-muted'>
            <div
              className='h-full rounded-full bg-orange-500 transition-all'
              style={{ width: `${report.forecast.confidence}%` }}
            />
          </div>
          <span className='text-xs text-muted-foreground'>
            {report.forecast.confidence}% confiança
          </span>
        </div>
      </div>
    </div>
  )
}

function parseMetricValue(value: string): number {
  const digits = value.replace(/[^\d]/g, '')
  return digits ? Number(digits) : 0
}
