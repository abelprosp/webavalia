import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Loader2, MessageSquare, Sparkles } from 'lucide-react'
import { getFoxAiStatus } from '@/lib/fox-ai-api'
import { FOX_AI_QUERY_META } from '@/lib/query-meta'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import { HeaderActions } from '@/components/layout/header-actions'
import { Main } from '@/components/layout/main'
import { LiveInsightsSidebar } from './components/live-insights-sidebar'
import { MarketReportCard } from './components/market-report-card'

export function FoxAiPage() {
  const {
    data: status,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['fox-ai', 'status'],
    queryFn: getFoxAiStatus,
    meta: FOX_AI_QUERY_META,
  })

  return (
    <>
      <Header>
        <HeaderActions />
      </Header>

      <Main>
        <div className='mb-6 flex flex-wrap items-center justify-between gap-4'>
          <div>
            <h1 className='flex items-center gap-2 text-2xl font-bold tracking-tight'>
              <Sparkles className='size-7 text-orange-500' />
              FoxAi
            </h1>
            <p className='text-muted-foreground'>
              Assistente imobiliário avançado — análise de portfólio, mercado e
              avaliações com IA
            </p>
          </div>
          {isLoading ? (
            <Loader2 className='size-4 animate-spin' />
          ) : isError ? (
            <Badge variant='destructive'>Serviço indisponível</Badge>
          ) : status?.available ? (
            <Badge
              variant='outline'
              className='border-orange-500/40 text-orange-600'
            >
              FoxAi disponível
            </Badge>
          ) : (
            <Badge variant='destructive'>FoxAi indisponível</Badge>
          )}
        </div>

        <Card className='mb-6 overflow-hidden border-orange-500/20 bg-gradient-to-r from-orange-500/10 via-background to-background'>
          <CardHeader className='gap-4 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <CardTitle className='flex items-center gap-2'>
                <MessageSquare className='size-5 text-orange-500' />
                Converse com a FoxAi
              </CardTitle>
              <CardDescription className='mt-1'>
                Abra o espaço dedicado para pesquisar o mercado, analisar
                avaliações e consultar seu histórico.
              </CardDescription>
            </div>
            <Button
              asChild
              className='shrink-0 bg-orange-500 hover:bg-orange-600'
            >
              <Link to='/fox-ai/chat'>
                Abrir chat
                <ArrowRight className='size-4' />
              </Link>
            </Button>
          </CardHeader>
        </Card>

        <div className='grid gap-6 lg:grid-cols-2'>
          <div>
            <LiveInsightsSidebar />
          </div>
          <div>
            <MarketReportCard />
          </div>
        </div>
      </Main>
    </>
  )
}
