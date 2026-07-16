import { useCallback, useState } from 'react'
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
import {
  getFoxAiConversation,
  getFoxAiStatus,
  type FoxAiMessage,
} from '@/lib/fox-ai-api'
import { FOX_AI_QUERY_META } from '@/lib/query-meta'
import { ConversationSidebar } from './components/conversation-sidebar'
import { FoxAiChat } from './components/fox-ai-chat'
import { LiveInsightsSidebar } from './components/live-insights-sidebar'
import { MarketReportCard } from './components/market-report-card'

const EMPTY_MESSAGES: FoxAiMessage[] = []

export function FoxAiPage() {
  const [activeConversationId, setActiveConversationId] = useState<
    string | undefined
  >()
  const [chatKey, setChatKey] = useState(0)

  const { data: status, isLoading, isError } = useQuery({
    queryKey: ['fox-ai', 'status'],
    queryFn: getFoxAiStatus,
    meta: FOX_AI_QUERY_META,
  })

  const { data: activeConversation } = useQuery({
    queryKey: ['fox-ai', 'conversation', activeConversationId],
    queryFn: () => getFoxAiConversation(activeConversationId!),
    enabled: Boolean(activeConversationId),
    meta: FOX_AI_QUERY_META,
  })

  const handleNewConversation = useCallback(() => {
    setActiveConversationId(undefined)
    setChatKey((k) => k + 1)
  }, [])

  const handleSelectConversation = useCallback((id: string) => {
    setActiveConversationId(id)
    setChatKey((k) => k + 1)
  }, [])

  const initialMessages = activeConversation?.messages ?? EMPTY_MESSAGES

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

        <div className='grid gap-6 lg:grid-cols-12'>
          <Card className='hidden lg:col-span-2 lg:block'>
            <CardContent className='pt-6'>
              <ConversationSidebar
                activeId={activeConversationId}
                onSelect={handleSelectConversation}
                onNew={handleNewConversation}
                className='h-[min(70vh,600px)]'
              />
            </CardContent>
          </Card>

          <Card className='lg:col-span-5'>
            <CardHeader>
              <CardTitle>Conversar com a FoxAi</CardTitle>
              <CardDescription>
                Streaming em tempo real, análise de imóveis e contexto do seu
                portfólio
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FoxAiChat
                key={`${chatKey}-${activeConversationId ?? 'new'}`}
                conversationId={activeConversationId}
                initialMessages={initialMessages}
                onConversationChange={setActiveConversationId}
                dashboardContext={{ currentPage: 'fox-ai' }}
              />
            </CardContent>
          </Card>

          <div className='space-y-4 lg:col-span-5'>
            <LiveInsightsSidebar />
            <MarketReportCard />
          </div>
        </div>
      </Main>
    </>
  )
}
