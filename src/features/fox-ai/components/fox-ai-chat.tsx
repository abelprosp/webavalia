import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BarChart3,
  Building2,
  CircleHelp,
  Loader2,
  Search,
  Send,
  Sparkles,
} from 'lucide-react'
import { useFoxAiChatStore } from '@/stores/fox-ai-chat-store'
import {
  getSuggestedPrompts,
  streamFoxAiMessage,
  type DashboardContext,
  type FoxAiMessage,
  type SuggestedPrompt,
} from '@/lib/fox-ai-api'
import { FOX_AI_QUERY_META } from '@/lib/query-meta'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
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
  /** Página /fox-ai/chat — estado no store (persiste ao sair da rota). */
  pageMode?: boolean
}

const EMPTY_MESSAGES: FoxAiMessage[] = []
const DEFAULT_PLACEHOLDER =
  'Pergunte sobre mercado, precificação, bairros, investimentos...'
const PAGE_SUGGESTIONS = [
  {
    title: 'Analisar imóvel',
    description: 'Compare preço, localização e potencial de valorização.',
    message: 'Quero analisar um imóvel e entender seu valor de mercado.',
    icon: Building2,
  },
  {
    title: 'Resumir mercado',
    description: 'Veja tendências, oportunidades e riscos do seu portfólio.',
    message: 'Resuma o cenário atual do meu mercado imobiliário.',
    icon: BarChart3,
  },
  {
    title: 'Responder dúvidas',
    description: 'Tire dúvidas sobre avaliações, bairros e investimentos.',
    message: 'Quero tirar uma dúvida sobre avaliação imobiliária.',
    icon: CircleHelp,
  },
] as const

export function FoxAiChat({
  conversationId: initialConversationId,
  dashboardContext,
  onConversationChange,
  className,
  compact = false,
  placeholder = DEFAULT_PLACEHOLDER,
  initialMessages = EMPTY_MESSAGES,
  showQuickActions = true,
  showEvaluationPicker = true,
  triggerMessage,
  pageMode = false,
}: FoxAiChatProps) {
  if (pageMode) {
    return (
      <FoxAiChatPageSession
        dashboardContext={dashboardContext}
        onConversationChange={onConversationChange}
        className={className}
        placeholder={placeholder}
        showQuickActions={showQuickActions}
        showEvaluationPicker={showEvaluationPicker}
      />
    )
  }

  return (
    <FoxAiChatLocalSession
      conversationId={initialConversationId}
      dashboardContext={dashboardContext}
      onConversationChange={onConversationChange}
      className={className}
      compact={compact}
      placeholder={placeholder}
      initialMessages={initialMessages}
      showQuickActions={showQuickActions}
      showEvaluationPicker={showEvaluationPicker}
      triggerMessage={triggerMessage}
    />
  )
}

type ChatViewProps = {
  messages: FoxAiMessage[]
  loading: boolean
  streamingContent: string
  error: string | null
  evaluationId: string | undefined
  onEvaluationChange: (id: string | undefined) => void
  input: string
  onInputChange: (value: string) => void
  onSend: (text: string) => void
  className?: string
  compact?: boolean
  pageMode?: boolean
  placeholder: string
  showQuickActions: boolean
  showEvaluationPicker: boolean
  prompts?: SuggestedPrompt[]
}

function FoxAiChatView({
  messages,
  loading,
  streamingContent,
  error,
  evaluationId,
  onEvaluationChange,
  input,
  onInputChange,
  onSend,
  className,
  compact = false,
  pageMode = false,
  placeholder,
  showQuickActions,
  showEvaluationPicker,
  prompts,
}: ChatViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const isStreaming = loading && streamingContent.length > 0

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, streamingContent])

  function handleSend() {
    onSend(input)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      {showEvaluationPicker && !compact && !pageMode && (
        <div className='mb-3'>
          <EvaluationPicker
            value={evaluationId}
            onChange={onEvaluationChange}
            disabled={loading}
          />
        </div>
      )}

      {showQuickActions && prompts && messages.length === 0 && !pageMode && (
        <QuickActionChips
          prompts={prompts}
          onSelect={(msg) => onSend(msg)}
          disabled={loading}
          className='mb-3'
        />
      )}

      <ScrollArea
        className={cn(
          'flex-1',
          compact ? 'h-72' : pageMode ? 'min-h-0' : 'h-[min(55vh,480px)]'
        )}
      >
        <div
          className={cn(
            'space-y-4 p-1 pe-3',
            pageMode && messages.length > 0 && 'mx-auto w-full max-w-3xl py-6'
          )}
        >
          {messages.length === 0 && (
            <div
              className={cn(
                'flex flex-col items-center justify-center gap-3 text-center text-muted-foreground',
                pageMode ? 'min-h-[28vh] pt-8' : 'py-12'
              )}
            >
              <div
                className={cn(
                  'flex items-center justify-center rounded-2xl bg-orange-500/10',
                  pageMode ? 'size-16' : 'size-12'
                )}
              >
                <Sparkles
                  className={cn(
                    'text-orange-500',
                    pageMode ? 'size-8' : 'size-6'
                  )}
                />
              </div>
              <div>
                <p
                  className={cn(
                    'font-medium text-foreground',
                    pageMode &&
                      'text-2xl font-semibold tracking-tight sm:text-3xl'
                  )}
                >
                  {pageMode
                    ? 'Vamos começar uma conversa inteligente'
                    : 'Olá! Sou a FoxAi'}
                </p>
                <p className='mx-auto mt-2 max-w-lg text-sm'>
                  Analise imóveis, avaliações e tendências de mercado com a
                  inteligência da FoxAi.
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
                    ? 'bg-primary text-sm leading-relaxed text-primary-foreground'
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
                  <p className='text-sm leading-relaxed whitespace-pre-wrap'>
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
          onSelect={(msg) => onSend(msg)}
          disabled={loading}
          className='mt-2'
        />
      )}

      <div
        className={cn(
          'mt-3 flex gap-2',
          pageMode &&
            'mx-auto w-full max-w-3xl rounded-2xl border bg-background p-3 shadow-sm ring-1 ring-black/5'
        )}
      >
        <div className={cn(pageMode && 'min-w-0 flex-1')}>
          <Textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              pageMode
                ? 'Pergunte qualquer coisa sobre imóveis...'
                : placeholder
            }
            rows={compact ? 2 : pageMode ? 2 : 3}
            disabled={loading}
            className={cn(
              'min-h-0 resize-none',
              pageMode &&
                'border-0 bg-transparent px-1 shadow-none focus-visible:ring-0'
            )}
          />
          {pageMode && (
            <div className='mt-2 flex flex-wrap items-center gap-2'>
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='h-8 gap-1.5 rounded-full border-orange-500/30 bg-orange-500/5 text-xs text-orange-700 hover:bg-orange-500/10 dark:text-orange-400'
                onClick={() =>
                  onInputChange(
                    'Faça uma pesquisa profunda sobre o mercado imobiliário e '
                  )
                }
                disabled={loading}
              >
                <Search className='size-3.5' />
                Pesquisa profunda
              </Button>
              {showEvaluationPicker && (
                <EvaluationPicker
                  value={evaluationId}
                  onChange={onEvaluationChange}
                  disabled={loading}
                />
              )}
            </div>
          )}
        </div>
        <Button
          size='icon'
          className={cn(
            'shrink-0 self-end bg-orange-500 hover:bg-orange-600',
            pageMode && 'size-10 rounded-full'
          )}
          onClick={handleSend}
          disabled={loading || !input.trim()}
          aria-label='Enviar mensagem'
        >
          <Send className='size-4' />
        </Button>
      </div>

      {pageMode && messages.length === 0 && (
        <div className='mx-auto mt-4 grid w-full max-w-3xl gap-3 pb-6 sm:grid-cols-3'>
          {PAGE_SUGGESTIONS.map((suggestion) => {
            const Icon = suggestion.icon
            return (
              <button
                key={suggestion.title}
                type='button'
                onClick={() => onSend(suggestion.message)}
                disabled={loading}
                className='group rounded-xl border bg-muted/30 p-4 text-start transition-colors hover:border-orange-500/30 hover:bg-orange-500/5 disabled:pointer-events-none disabled:opacity-50'
              >
                <Icon className='mb-3 size-5 text-orange-500' />
                <p className='text-sm font-semibold'>{suggestion.title}</p>
                <p className='mt-1 text-xs leading-relaxed text-muted-foreground'>
                  {suggestion.description}
                </p>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FoxAiChatPageSession({
  dashboardContext,
  onConversationChange,
  className,
  placeholder,
  showQuickActions,
  showEvaluationPicker,
}: {
  dashboardContext?: DashboardContext
  onConversationChange?: (id: string) => void
  className?: string
  placeholder: string
  showQuickActions: boolean
  showEvaluationPicker: boolean
}) {
  const queryClient = useQueryClient()
  const [input, setInput] = useState('')
  const sessionVersion = useFoxAiChatStore((s) => s.sessionVersion)
  const messages = useFoxAiChatStore((s) => s.messages)
  const loading = useFoxAiChatStore((s) => s.loading)
  const streamingContent = useFoxAiChatStore((s) => s.streamingContent)
  const evaluationId = useFoxAiChatStore((s) => s.evaluationId)
  const error = useFoxAiChatStore((s) => s.error)
  const setEvaluationId = useFoxAiChatStore((s) => s.setEvaluationId)
  const sendMessage = useFoxAiChatStore((s) => s.sendMessage)

  const { data: prompts } = useQuery({
    queryKey: ['fox-ai', 'suggested-prompts'],
    queryFn: getSuggestedPrompts,
    staleTime: 120_000,
    meta: FOX_AI_QUERY_META,
    enabled: showQuickActions,
  })

  useEffect(() => {
    setInput('')
  }, [sessionVersion])

  const handleSend = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return
      setInput('')
      void sendMessage({
        text: trimmed,
        dashboardContext,
        queryClient,
        onConversationChange,
      })
    },
    [sendMessage, dashboardContext, queryClient, onConversationChange]
  )

  return (
    <FoxAiChatView
      messages={messages}
      loading={loading}
      streamingContent={streamingContent}
      error={error}
      evaluationId={evaluationId}
      onEvaluationChange={setEvaluationId}
      input={input}
      onInputChange={setInput}
      onSend={handleSend}
      className={className}
      pageMode
      placeholder={placeholder}
      showQuickActions={showQuickActions}
      showEvaluationPicker={showEvaluationPicker}
      prompts={prompts}
    />
  )
}

function FoxAiChatLocalSession({
  conversationId: initialConversationId,
  dashboardContext,
  onConversationChange,
  className,
  compact = false,
  placeholder = DEFAULT_PLACEHOLDER,
  initialMessages = EMPTY_MESSAGES,
  showQuickActions = true,
  showEvaluationPicker = true,
  triggerMessage,
}: Omit<FoxAiChatProps, 'pageMode'>) {
  const queryClient = useQueryClient()
  const [messages, setMessages] = useState<FoxAiMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [conversationId, setConversationId] = useState(initialConversationId)
  const [evaluationId, setEvaluationId] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)
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

  return (
    <FoxAiChatView
      messages={messages}
      loading={loading}
      streamingContent={streamingContent}
      error={error}
      evaluationId={evaluationId}
      onEvaluationChange={setEvaluationId}
      input={input}
      onInputChange={setInput}
      onSend={(text) => void sendMessage(text)}
      className={className}
      compact={compact}
      placeholder={placeholder}
      showQuickActions={showQuickActions}
      showEvaluationPicker={showEvaluationPicker}
      prompts={prompts}
    />
  )
}
