import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useRouterState } from '@tanstack/react-router'
import { ExternalLink, Loader2, Sparkles, X } from 'lucide-react'
import { useFoxAiChatStore } from '@/stores/fox-ai-chat-store'
import { getSuggestedPrompts, type DashboardContext } from '@/lib/fox-ai-api'
import { FOX_AI_QUERY_META } from '@/lib/query-meta'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { FoxAiChat } from './fox-ai-chat'
import { QuickActionChips } from './quick-action-chips'

type FoxAiWidgetProps = {
  dashboardContext?: DashboardContext
}

export function FoxAiWidget({ dashboardContext }: FoxAiWidgetProps) {
  const [open, setOpen] = useState(false)
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null)
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const isBackgroundBusy = useFoxAiChatStore((s) => s.loading)

  const { data: prompts } = useQuery({
    queryKey: ['fox-ai', 'suggested-prompts'],
    queryFn: getSuggestedPrompts,
    staleTime: 120_000,
    meta: FOX_AI_QUERY_META,
    enabled: open,
  })

  if (pathname === '/fox-ai/chat') return null

  return (
    <>
      <Button
        size='lg'
        className='fixed relative end-6 bottom-6 z-50 size-14 rounded-full bg-orange-500 shadow-lg hover:bg-orange-600'
        onClick={() => setOpen(true)}
        aria-label={
          isBackgroundBusy
            ? 'Abrir FoxAi — análise em andamento'
            : 'Abrir FoxAi'
        }
      >
        {isBackgroundBusy ? (
          <Loader2 className='size-6 animate-spin' />
        ) : (
          <Sparkles className='size-6' />
        )}
        {isBackgroundBusy && (
          <span className='absolute -end-0.5 -top-0.5 size-3 rounded-full bg-emerald-400 ring-2 ring-background' />
        )}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side='right' className='flex w-full flex-col sm:max-w-md'>
          <SheetHeader>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <div className='flex size-8 items-center justify-center rounded-full bg-orange-500/10'>
                  <Sparkles className='size-4 text-orange-500' />
                </div>
                <div>
                  <SheetTitle>FoxAi</SheetTitle>
                  <SheetDescription>
                    {isBackgroundBusy
                      ? 'Análise em andamento no chat'
                      : 'Especialista em imóveis com IA'}
                  </SheetDescription>
                </div>
              </div>
              <Button variant='ghost' size='icon' asChild>
                <Link to='/fox-ai/chat'>
                  <ExternalLink className='size-4' />
                  <span className='sr-only'>Abrir chat completo</span>
                </Link>
              </Button>
            </div>
          </SheetHeader>

          {isBackgroundBusy && (
            <div className='mt-3 flex items-center gap-2 rounded-lg border border-orange-500/20 bg-orange-500/5 px-3 py-2 text-xs text-orange-800 dark:text-orange-300'>
              <Loader2 className='size-3.5 shrink-0 animate-spin' />
              <span className='min-w-0 flex-1'>
                Sua pesquisa/análise continua no chat. Volte para acompanhar.
              </span>
              <Button
                variant='ghost'
                size='sm'
                className='h-7 shrink-0 px-2'
                asChild
              >
                <Link to='/fox-ai/chat'>Abrir</Link>
              </Button>
            </div>
          )}

          {prompts && (
            <QuickActionChips
              prompts={prompts.slice(0, 4)}
              onSelect={setTriggerMessage}
              className='mt-3'
            />
          )}

          <div className='flex flex-1 flex-col overflow-hidden pt-4'>
            <FoxAiChat
              compact
              showQuickActions={false}
              showEvaluationPicker={false}
              triggerMessage={triggerMessage}
              dashboardContext={{
                ...dashboardContext,
                currentPage: dashboardContext?.currentPage ?? 'widget',
              }}
            />
          </div>

          <Button
            variant='ghost'
            size='sm'
            className='mt-2 self-center text-muted-foreground'
            onClick={() => setOpen(false)}
          >
            <X className='me-1 size-3' />
            Fechar
          </Button>
        </SheetContent>
      </Sheet>
    </>
  )
}
