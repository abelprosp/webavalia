import { useQuery } from '@tanstack/react-query'
import { Loader2, Sparkles } from 'lucide-react'
import { HeaderActions } from '@/components/layout/header-actions'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { getFoxAiStatus } from '@/lib/fox-ai-api'
import { FoxAiChat } from './components/fox-ai-chat'
import { MarketInsightsPanel } from './components/market-insights-panel'

export function FoxAiPage() {
  const { data: status, isLoading } = useQuery({
    queryKey: ['fox-ai', 'status'],
    queryFn: getFoxAiStatus,
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
              Especialista em imóveis com IA — análise de mercado, portfólio e
              conversação inteligente
            </p>
          </div>
          {isLoading ? (
            <Loader2 className='size-4 animate-spin' />
          ) : status?.available ? (
            <Badge
              variant='outline'
              className='border-orange-500/40 text-orange-600'
            >
              NVIDIA NIM · {status.model}
            </Badge>
          ) : (
            <Badge variant='destructive'>Configure NVIDIA_API_KEY</Badge>
          )}
        </div>

        <div className='mb-6'>
          <MarketInsightsPanel />
        </div>

        <div className='grid gap-6 lg:grid-cols-5'>
          <Card className='lg:col-span-3'>
            <CardHeader>
              <CardTitle>Conversar com a FoxAi</CardTitle>
              <CardDescription>
                Tire dúvidas sobre mercado, precificação, investimentos e
                estratégias imobiliárias
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FoxAiChat
                dashboardContext={{ currentPage: 'fox-ai' }}
              />
            </CardContent>
          </Card>

          <Card className='lg:col-span-2'>
            <CardHeader>
              <CardTitle>Capacidades HouseCanary</CardTitle>
              <CardDescription>
                Funcionalidades inspiradas na plataforma líder em analytics
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4 text-sm'>
              <FeatureItem
                title='AVM — Avaliação Automatizada'
                description='Valores estimados com base nas suas avaliações e comparáveis de mercado.'
              />
              <FeatureItem
                title='Previsão de mercado'
                description='Tendências de valorização e projeções para os próximos meses.'
              />
              <FeatureItem
                title='Monitoramento de portfólio'
                description='Acompanhe bairros, riscos hídricos e volume de avaliações.'
              />
              <FeatureItem
                title='Alertas inteligentes'
                description='Sinais de risco, oportunidade e créditos baixos em tempo real.'
              />
              <FeatureItem
                title='Análise conversacional'
                description='Pergunte qualquer coisa sobre imóveis — a FoxAi responde com contexto.'
              />
            </CardContent>
          </Card>
        </div>
      </Main>
    </>
  )
}

function FeatureItem({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className='rounded-lg border p-3'>
      <p className='font-medium'>{title}</p>
      <p className='mt-1 text-muted-foreground'>{description}</p>
    </div>
  )
}
