import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Send, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import {
  getSuggestedPrompts,
  streamFoxAiMessage,
  type DashboardContext,
  type FoxAiMessage,
} from '@/lib/fox-ai-api'
import { FOX_AI_QUERY_META } from '@/lib/query-meta'
import { cn } from '@/lib/utils'
import { EvaluationPicker } from './evaluation-picker'
import { FoxAiMarkdown } from './fox-ai-markdown'
import { QuickActionChips } from './quick-action-chips'

type FoxAiChatProps = {
  conversationId?: string
  dashboardContext?: DashboardContext
  onConversationChange?: (id: string) => void
  className?: string
  compact?: boolean
  placeholder?: string
  initialMessages?: FoxAiMessage[]
  showQuickActions?: boolean
  showEvaluationPicker?: boolean
  triggerMessage?: string | null
}

const EMPTY_MESSAGES: FoxAiMessage[] = []

export function FoxAiChat({
  conversationId: initialConversationId,
  dashboardContext,
  onConversationChange,
  className,
  compact = false,
  placeholder = 'Pergunte sobre mercado, precificação, bairros, investimentos...',
  initialMessages = EMPTY_MESSAGES,
  showQuickActions = true,
  showEvaluationPicker = true,
  triggerMessage,
}: FoxAiChatProps) {
  const queryClient = useQueryClient()
  const [messages, setMessages] = useState<FoxAiMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [conversationId, setConversationId] = useState(initialConversationId)
  const [evaluationId, setEvaluationId] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const { data: prompts } = useQuery({
    queryKey: ['fox-ai', 'suggested-prompts'],
    queryFn: getSuggestedPrompts,
    staleTime: 120_000,
    meta: FOX_AI_QUERY_META,
    enabled: showQuickActions,
  })

  useEffect(() => {
    setMessages(initialMessages)
  }, [initialMessages])

  useEffect(() => {
    setConversationId(initialConversationId)
  }, [initialConversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, streamingContent])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || loading) return

      setInput('')
      setError(null)
      setLoading(true)
      setStreamingContent('')

      const optimisticUser: FoxAiMessage = {
        id: `temp-user-${Date.now()}`,
        role: 'user',
        content: trimmed,
        createdAt: new Date().toISOString(),
      }
      const streamingId = `temp-assistant-${Date.now()}`
      const optimisticAssistant: FoxAiMessage = {
        id: streamingId,
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, optimisticUser, optimisticAssistant])

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      await streamFoxAiMessage(
        {
          message: trimmed,
          conversationId,
          evaluationId,
          dashboardContext,
        },
        {
          onChunk: (chunk) => {
            setStreamingContent((prev) => {
              const next = prev + chunk
              setMessages((msgs) =>
                msgs.map((m) =>
                  m.id === streamingId ? { ...m, content: next } : m
                )
              )
              return next
            })
          },
          onDone: (result) => {
            setConversationId(result.conversationId)
            onConversationChange?.(result.conversationId)
            setMessages((prev) => [
              ...prev.filter(
                (m) => m.id !== optimisticUser.id && m.id !== streamingId
              ),
              result.userMessage,
              result.assistantMessage,
            ])
            setStreamingContent('')
            void queryClient.invalidateQueries({
              queryKey: ['fox-ai', 'conversations'],
            })
          },
          onError: (message) => {
            setMessages((prev) =>
              prev.filter(
                (m) => m.id !== optimisticUser.id && m.id !== streamingId
              )
            )
            setStreamingContent('')
            setError(message)
          },
        },
        controller.signal
      )

      setLoading(false)
    },
    [
      loading,
      conversationId,
      evaluationId,
      dashboardContext,
      onConversationChange,
      queryClient,
    ]
  )

  const lastTriggerRef = useRef<string | null>(null)
  useEffect(() => {
    if (triggerMessage && triggerMessage !== lastTriggerRef.current) {
      lastTriggerRef.current = triggerMessage
      void sendMessage(triggerMessage)
    }
  }, [triggerMessage, sendMessage])

  function handleSend() {
    void sendMessage(input)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const isStreaming = loading && streamingContent.length > 0

  return (
    <div className={cn('flex flex-col', className)}>
      {showEvaluationPicker && !compact && (
        <div className='mb-3'>
          <EvaluationPicker
            value={evaluationId}
            onChange={setEvaluationId}
            disabled={loading}
          />
        </div>
      )}

      {showQuickActions && prompts && messages.length === 0 && (
        <QuickActionChips
          prompts={prompts}
          onSelect={(msg) => void sendMessage(msg)}
          disabled={loading}
          className='mb-3'
        />
      )}

      <ScrollArea
        className={cn('flex-1', compact ? 'h-72' : 'h-[min(55vh,480px)]')}
      >
        <div className='space-y-4 p-1 pe-3'>
          {messages.length === 0 && (
            <div className='flex flex-col items-center justify-center gap-3 py-12 text-center text-muted-foreground'>
              <div className='flex size-12 items-center justify-center rounded-full bg-orange-500/10'>
                <Sparkles className='size-6 text-orange-500' />
              </div>
              <div>
                <p className='font-medium text-foreground'>Olá! Sou a FoxAi</p>
                <p className='mt-1 max-w-sm text-sm'>
                  Especialista em imóveis. Analiso seu portfólio, mercado e
                  avaliações em tempo real.
                </p>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  'max-w-[90%] rounded-2xl px-4 py-2.5',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground text-sm leading-relaxed'
                    : 'bg-muted text-foreground'
                )}
              >
                {message.role === 'assistant' && (
                  <span className='mb-1 block text-xs font-semibold text-orange-500'>
                    FoxAi
                  </span>
                )}
                {message.role === 'assistant' ? (
                  message.content ? (
                    <FoxAiMarkdown content={message.content} />
                  ) : (
                    <span className='flex items-center gap-2 text-sm text-muted-foreground'>
                      <Loader2 className='size-3.5 animate-spin' />
                      Analisando...
                    </span>
                  )
                ) : (
                  <p className='whitespace-pre-wrap text-sm leading-relaxed'>
                    {message.content}
                  </p>
                )}
              </div>
            </div>
          ))}

          {loading && !isStreaming && (
            <div className='flex justify-start'>
              <div className='flex items-center gap-2 rounded-2xl bg-muted px-4 py-2.5 text-sm text-muted-foreground'>
                <Loader2 className='size-4 animate-spin' />
                FoxAi está analisando...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {error && (
        <p className='mt-2 text-sm text-destructive' role='alert'>
          {error}
        </p>
      )}

      {showQuickActions && prompts && messages.length > 0 && !compact && (
        <QuickActionChips
          prompts={prompts.slice(0, 3)}
          onSelect={(msg) => void sendMessage(msg)}
          disabled={loading}
          className='mt-2'
        />
      )}

      <div className='mt-3 flex gap-2'>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={compact ? 2 : 3}
          disabled={loading}
          className='min-h-0 resize-none'
        />
        <Button
          size='icon'
          className='shrink-0 self-end bg-orange-500 hover:bg-orange-600'
          onClick={handleSend}
          disabled={loading || !input.trim()}
          aria-label='Enviar mensagem'
        >
          <Send className='size-4' />
        </Button>
      </div>
    </div>
  )
}
