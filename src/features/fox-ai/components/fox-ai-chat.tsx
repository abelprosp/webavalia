import { useEffect, useRef, useState } from 'react'
import { AxiosError } from 'axios'
import { Loader2, Send, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  sendFoxAiMessage,
  type DashboardContext,
  type FoxAiMessage,
} from '@/lib/fox-ai-api'

type FoxAiChatProps = {
  conversationId?: string
  dashboardContext?: DashboardContext
  onConversationChange?: (id: string) => void
  className?: string
  compact?: boolean
  placeholder?: string
  initialMessages?: FoxAiMessage[]
}

function getFoxAiErrorMessage(err: unknown) {
  if (err instanceof AxiosError) {
    const message = err.response?.data?.message
    if (typeof message === 'string' && message.length > 0) return message
    if (err.response?.status === 503) {
      return 'FoxAi indisponível no momento. Tente novamente mais tarde.'
    }
  }
  if (err instanceof Error && err.message) return err.message
  return 'Não foi possível enviar a mensagem.'
}

export function FoxAiChat({
  conversationId: initialConversationId,
  dashboardContext,
  onConversationChange,
  className,
  compact = false,
  placeholder = 'Pergunte sobre mercado, precificação, bairros, investimentos...',
  initialMessages = [],
}: FoxAiChatProps) {
  const [messages, setMessages] = useState<FoxAiMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState(initialConversationId)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMessages(initialMessages)
  }, [initialMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    setError(null)
    setLoading(true)

    const optimisticUser: FoxAiMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticUser])

    try {
      const result = await sendFoxAiMessage({
        message: text,
        conversationId,
        dashboardContext,
      })
      setConversationId(result.conversationId)
      onConversationChange?.(result.conversationId)
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimisticUser.id),
        result.userMessage,
        result.assistantMessage,
      ])
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id))
      setError(getFoxAiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <ScrollArea className={cn('flex-1', compact ? 'h-72' : 'h-[min(60vh,520px)]')}>
        <div className='space-y-4 p-1 pe-3'>
          {messages.length === 0 && (
            <div className='flex flex-col items-center justify-center gap-3 py-12 text-center text-muted-foreground'>
              <div className='flex size-12 items-center justify-center rounded-full bg-orange-500/10'>
                <Sparkles className='size-6 text-orange-500' />
              </div>
              <div>
                <p className='font-medium text-foreground'>Olá! Sou a FoxAi</p>
                <p className='mt-1 max-w-sm text-sm'>
                  Especialista em imóveis. Posso analisar seu portfólio, mercado
                  e dashboard em tempo real.
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
                  'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                )}
              >
                {message.role === 'assistant' && (
                  <span className='mb-1 block text-xs font-semibold text-orange-500'>
                    FoxAi
                  </span>
                )}
                <p className='whitespace-pre-wrap'>{message.content}</p>
              </div>
            </div>
          ))}

          {loading && (
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
          onClick={() => void handleSend()}
          disabled={loading || !input.trim()}
          aria-label='Enviar mensagem'
        >
          <Send className='size-4' />
        </Button>
      </div>
    </div>
  )
}
