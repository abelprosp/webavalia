import { useQuery } from '@tanstack/react-query'
import { isToday, isYesterday } from 'date-fns'
import {
  BarChart3,
  Building2,
  FileText,
  Loader2,
  MessageSquare,
  Plus,
  Sparkles,
} from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  listFoxAiConversations,
  type FoxAiConversationSummary,
} from '@/lib/fox-ai-api'
import { FOX_AI_QUERY_META } from '@/lib/query-meta'
import { cn } from '@/lib/utils'

type ConversationSidebarProps = {
  activeId?: string
  onSelect: (id: string) => void
  onNew: () => void
  className?: string
  onNavigate?: () => void
}

type ConversationGroup = {
  label: string
  conversations: FoxAiConversationSummary[]
}

function groupConversations(
  conversations: FoxAiConversationSummary[]
): ConversationGroup[] {
  const groups: ConversationGroup[] = [
    { label: 'Hoje', conversations: [] },
    { label: 'Ontem', conversations: [] },
    { label: 'Anteriores', conversations: [] },
  ]

  conversations.forEach((conversation) => {
    const updatedAt = new Date(conversation.updatedAt)
    const group = isToday(updatedAt)
      ? groups[0]
      : isYesterday(updatedAt)
        ? groups[1]
        : groups[2]
    group.conversations.push(conversation)
  })

  return groups.filter((group) => group.conversations.length > 0)
}

export function ConversationSidebar({
  activeId,
  onSelect,
  onNew,
  className,
  onNavigate,
}: ConversationSidebarProps) {
  const { data: conversations, isLoading } = useQuery({
    queryKey: ['fox-ai', 'conversations'],
    queryFn: listFoxAiConversations,
    meta: FOX_AI_QUERY_META,
  })

  const groups = groupConversations(conversations ?? [])

  return (
    <div className={cn('flex min-h-0 flex-col bg-muted/30', className)}>
      <div className='border-b p-4'>
        <div className='mb-4 flex items-center gap-2 px-1'>
          <div className='flex size-9 items-center justify-center rounded-xl bg-orange-500 text-white shadow-sm'>
            <Sparkles className='size-4' />
          </div>
          <div>
            <p className='font-semibold leading-none'>FoxAi</p>
            <p className='mt-1 text-xs text-muted-foreground'>Assistente imobiliário</p>
          </div>
        </div>
        <Button
          onClick={onNew}
          className='w-full justify-start gap-2 bg-orange-500 text-white shadow-sm hover:bg-orange-600'
        >
          <Plus className='size-4' />
          Nova conversa
        </Button>
      </div>

      <nav className='space-y-1 border-b p-3' aria-label='Atalhos da FoxAi'>
        <Button variant='ghost' className='w-full justify-start gap-2' asChild>
          <Link to='/fox-ai' onClick={onNavigate}>
            <BarChart3 className='size-4' />
            Explorar mercado
          </Link>
        </Button>
        <Button variant='ghost' className='w-full justify-start gap-2' asChild>
          <Link to='/avaliacao' onClick={onNavigate}>
            <Building2 className='size-4' />
            Base de avaliações
          </Link>
        </Button>
        <Button variant='ghost' className='w-full justify-start gap-2' asChild>
          <Link to='/fox-ai' onClick={onNavigate}>
            <FileText className='size-4' />
            Relatórios
          </Link>
        </Button>
      </nav>

      <div className='px-4 pb-2 pt-4'>
        <p className='text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
          Conversas
        </p>
      </div>

      <ScrollArea className='min-h-0 flex-1'>
        {isLoading ? (
          <div className='flex justify-center py-8'>
            <Loader2 className='size-5 animate-spin text-muted-foreground' />
          </div>
        ) : !conversations?.length ? (
          <p className='py-4 text-center text-xs text-muted-foreground'>
            Nenhuma conversa ainda
          </p>
        ) : (
          <div className='space-y-5 px-3 pb-4'>
            {groups.map((group) => (
              <section key={group.label}>
                <p className='mb-1.5 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground'>
                  {group.label}
                </p>
                <div className='space-y-0.5'>
                  {group.conversations.map((conv) => (
                    <button
                      key={conv.id}
                      type='button'
                      onClick={() => {
                        onSelect(conv.id)
                        onNavigate?.()
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-start text-sm transition-colors hover:bg-background',
                        activeId === conv.id &&
                          'bg-background font-medium text-orange-600 shadow-sm ring-1 ring-border'
                      )}
                    >
                      <MessageSquare className='size-3.5 shrink-0 text-muted-foreground' />
                      <p className='truncate'>{conv.title}</p>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
