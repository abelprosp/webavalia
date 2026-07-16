import { useCallback, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Menu, Sparkles } from 'lucide-react'
import { HeaderActions } from '@/components/layout/header-actions'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  getFoxAiConversation,
  type FoxAiMessage,
} from '@/lib/fox-ai-api'
import { FOX_AI_QUERY_META } from '@/lib/query-meta'
import { ConversationSidebar } from './components/conversation-sidebar'
import { FoxAiChat } from './components/fox-ai-chat'

const EMPTY_MESSAGES: FoxAiMessage[] = []
const CHAT_DASHBOARD_CONTEXT = { currentPage: 'fox-ai-chat' } as const

export function FoxAiChatPage() {
  const [activeConversationId, setActiveConversationId] = useState<
    string | undefined
  >()
  const [chatKey, setChatKey] = useState(0)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const { data: activeConversation, isFetching: isLoadingConversation } =
    useQuery({
      queryKey: ['fox-ai', 'conversation', activeConversationId],
      queryFn: () => getFoxAiConversation(activeConversationId!),
      enabled: Boolean(activeConversationId),
      meta: FOX_AI_QUERY_META,
    })

  const handleNewConversation = useCallback(() => {
    setActiveConversationId(undefined)
    setChatKey((key) => key + 1)
    setMobileSidebarOpen(false)
  }, [])

  const handleSelectConversation = useCallback((id: string) => {
    setActiveConversationId(id)
    setChatKey((key) => key + 1)
  }, [])

  const initialMessages = activeConversation?.messages ?? EMPTY_MESSAGES

  const sidebar = (
    <ConversationSidebar
      activeId={activeConversationId}
      onSelect={handleSelectConversation}
      onNew={handleNewConversation}
      onNavigate={() => setMobileSidebarOpen(false)}
      className='h-full'
    />
  )

  return (
    <>
      <Header className='border-b'>
        <Button
          variant='outline'
          size='icon'
          className='md:hidden'
          onClick={() => setMobileSidebarOpen(true)}
          aria-label='Abrir histórico de conversas'
        >
          <Menu className='size-4' />
        </Button>
        <div className='flex min-w-0 flex-1 items-center gap-2'>
          <Sparkles className='size-5 shrink-0 text-orange-500' />
          <div className='min-w-0'>
            <p className='truncate text-sm font-semibold'>Chat FoxAi</p>
            <p className='truncate text-xs text-muted-foreground'>
              Inteligência imobiliária em tempo real
            </p>
          </div>
        </div>
        <HeaderActions />
      </Header>

      <Main fixed fluid className='min-h-0 p-0'>
        <div className='flex min-h-0 flex-1 overflow-hidden'>
          <aside className='hidden w-72 shrink-0 border-e md:block'>
            {sidebar}
          </aside>

          <section className='min-w-0 flex-1 bg-background'>
            {activeConversationId &&
            isLoadingConversation &&
            !activeConversation ? (
              <div className='flex h-full items-center justify-center text-muted-foreground'>
                <Loader2 className='size-6 animate-spin' />
                <span className='sr-only'>Carregando conversa</span>
              </div>
            ) : (
              <FoxAiChat
                key={chatKey}
                pageMode
                conversationId={activeConversationId}
                initialMessages={initialMessages}
                onConversationChange={setActiveConversationId}
                dashboardContext={CHAT_DASHBOARD_CONTEXT}
                className='h-full px-4 sm:px-6'
              />
            )}
          </section>
        </div>
      </Main>

      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side='left' className='w-[min(88vw,20rem)] gap-0 p-0'>
          <SheetHeader className='sr-only'>
            <SheetTitle>Navegação do chat FoxAi</SheetTitle>
            <SheetDescription>
              Atalhos e histórico de conversas
            </SheetDescription>
          </SheetHeader>
          {sidebar}
        </SheetContent>
      </Sheet>
    </>
  )
}
