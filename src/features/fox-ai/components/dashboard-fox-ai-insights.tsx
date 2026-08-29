import { useEffect, useRef } from 'react'
import { AxiosError } from 'axios'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { FOX_AI_ENABLED } from '@/lib/feature-flags'
import {
  getDashboardInsight,
  getFoxAiStatus,
  type DashboardContext,
} from '@/lib/fox-ai-api'
import { FOX_AI_QUERY_META } from '@/lib/query-meta'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { FoxAiMarkdown } from './fox-ai-markdown'

type DashboardFoxAiInsightsProps = {
  dashboardContext: DashboardContext
}

export function DashboardFoxAiInsights(props: DashboardFoxAiInsightsProps) {
  if (!FOX_AI_ENABLED) return null
  return <DashboardFoxAiInsightsContent {...props} />
}

function DashboardFoxAiInsightsContent({
  dashboardContext,
}: DashboardFoxAiInsightsProps) {
  const autoLoadedRef = useRef(false)

  const { data: status } = useQuery({
    queryKey: ['fox-ai', 'status'],
    queryFn: getFoxAiStatus,
    meta: FOX_AI_QUERY_META,
  })

  const mutation = useMutation({
    mutationFn: (force: boolean) =>
      getDashboardInsight(force, dashboardContext),
    meta: FOX_AI_QUERY_META,
  })

  useEffect(() => {
    if (
      status?.available &&
      !autoLoadedRef.current &&
      !mutation.isPending &&
      !mutation.data
    ) {
      autoLoadedRef.current = true
      mutation.mutate(false)
    }
  }, [status?.available, mutation.isPending, mutation.data, mutation.mutate])

  const analysis = mutation.data?.analysis
  const generatedAt = mutation.data?.generatedAt
  const cached = mutation.data?.cached

  return (
    <Card className='border-orange-500/20'>
      <CardHeader>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div>
            <CardTitle className='flex items-center gap-2'>
              <Sparkles className='size-5 text-orange-500' />
              FoxAi — Análise em tempo real
            </CardTitle>
            <CardDescription>
              Insights proativos sobre tendências, alertas e oportunidades do
              seu portfólio
            </CardDescription>
          </div>
          <Button
            variant='outline'
            size='sm'
            onClick={() => mutation.mutate(true)}
            disabled={mutation.isPending || !status?.available}
            className='border-orange-500/30'
          >
            {mutation.isPending ? (
              <Loader2 className='me-1 size-4 animate-spin' />
            ) : (
              <RefreshCw className='me-1 size-4' />
            )}
            {analysis ? 'Atualizar análise' : 'Analisar agora'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!status?.available && (
          <p className='text-sm text-muted-foreground'>
            FoxAi indisponível no momento.
          </p>
        )}

        {mutation.isError && (
          <p className='text-sm text-destructive'>
            {mutation.error instanceof AxiosError &&
            typeof mutation.error.response?.data?.message === 'string'
              ? mutation.error.response.data.message
              : mutation.error instanceof Error
                ? mutation.error.message
                : 'Erro ao analisar o dashboard.'}
          </p>
        )}

        {status?.available && mutation.isPending && !analysis && (
          <div className='flex items-center gap-2 text-sm text-muted-foreground'>
            <Loader2 className='size-4 animate-spin text-orange-500' />
            FoxAi está analisando seu portfólio...
          </div>
        )}

        {analysis && (
          <div className='space-y-2'>
            {generatedAt && (
              <p className='text-xs text-muted-foreground'>
                {cached ? 'Cache · ' : ''}
                Atualizado em {new Date(generatedAt).toLocaleString('pt-BR')}
              </p>
            )}
            <FoxAiMarkdown content={analysis} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
