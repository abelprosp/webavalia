import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { analyzeDashboard, type DashboardContext } from '@/lib/fox-ai-api'

type DashboardFoxAiInsightsProps = {
  dashboardContext: DashboardContext
}

export function DashboardFoxAiInsights({
  dashboardContext,
}: DashboardFoxAiInsightsProps) {
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => analyzeDashboard(dashboardContext),
    onSuccess: (data) => {
      setAnalysis(data.analysis)
      setGeneratedAt(data.generatedAt)
    },
  })

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
              A IA monitora seu dashboard e identifica tendências, alertas e
              oportunidades como a HouseCanary
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
            {analysis ? 'Atualizar análise' : 'Analisar agora'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {mutation.isError && (
          <p className='text-sm text-destructive'>
            {mutation.error instanceof Error
              ? mutation.error.message
              : 'Erro ao analisar o dashboard.'}
          </p>
        )}

        {!analysis && !mutation.isPending && !mutation.isError && (
          <p className='text-sm text-muted-foreground'>
            Clique em &quot;Analisar agora&quot; para a FoxAi interpretar seus
            números, leads e avaliações em tempo real.
          </p>
        )}

        {mutation.isPending && (
          <div className='flex items-center gap-2 text-sm text-muted-foreground'>
            <Loader2 className='size-4 animate-spin text-orange-500' />
            FoxAi está analisando movimentações do dashboard...
          </div>
        )}

        {analysis && (
          <div className='space-y-2'>
            {generatedAt && (
              <p className='text-xs text-muted-foreground'>
                Atualizado em{' '}
                {new Date(generatedAt).toLocaleString('pt-BR')}
              </p>
            )}
            <div className='prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed'>
              {analysis}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
