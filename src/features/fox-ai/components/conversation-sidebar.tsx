import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Loader2, MessageSquare, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { listFoxAiConversations } from '@/lib/fox-ai-api'
import { FOX_AI_QUERY_META } from '@/lib/query-meta'
import { cn } from '@/lib/utils'

type ConversationSidebarProps = {
  activeId?: string
  onSelect: (id: string) => void
  onNew: () => void
  className?: string
}

export function ConversationSidebar({
  activeId,
  onSelect,
  onNew,
  className,
}: ConversationSidebarProps) {
  const { data: conversations, isLoading } = useQuery({
    queryKey: ['fox-ai', 'conversations'],
    queryFn: listFoxAiConversations,
    meta: FOX_AI_QUERY_META,
  })

  return (
    <div className={cn('flex flex-col', className)}>
      <div className='mb-3 flex items-center justify-between'>
        <p className='text-sm font-medium'>Histórico</p>
        <Button variant='ghost' size='sm' onClick={onNew} className='h-7 gap-1 px-2'>
          <Plus className='size-3.5' />
          Nova
        </Button>
      </div>

      <ScrollArea className='flex-1'>
        {isLoading ? (
          <div className='flex justify-center py-8'>
            <Loader2 className='size-5 animate-spin text-muted-foreground' />
          </div>
        ) : !conversations?.length ? (
          <p className='py-4 text-center text-xs text-muted-foreground'>
            Nenhuma conversa ainda
          </p>
        ) : (
          <div className='space-y-1 pe-2'>
            {conversations.map((conv) => (
              <button
                key={conv.id}
                type='button'
                onClick={() => onSelect(conv.id)}
                className={cn(
                  'flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-start text-sm transition-colors hover:bg-muted',
                  activeId === conv.id && 'bg-orange-500/10 ring-1 ring-orange-500/30'
                )}
              >
                <MessageSquare className='mt-0.5 size-3.5 shrink-0 text-muted-foreground' />
                <div className='min-w-0 flex-1'>
                  <p className='truncate font-medium'>{conv.title}</p>
                  <p className='text-xs text-muted-foreground'>
                    {formatDistanceToNow(new Date(conv.updatedAt), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
