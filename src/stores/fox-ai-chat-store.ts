import type { QueryClient } from '@tanstack/react-query'
import { create } from 'zustand'
import {
  streamFoxAiMessage,
  type DashboardContext,
  type FoxAiMessage,
} from '@/lib/fox-ai-api'

const EMPTY_MESSAGES: FoxAiMessage[] = []

/** AbortController fora do estado Zustand — não serializável e deve sobreviver a remounts. */
let abortController: AbortController | null = null

type SendMessageArgs = {
  text: string
  dashboardContext?: DashboardContext
  queryClient?: QueryClient
  onConversationChange?: (id: string) => void
}

type FoxAiChatStore = {
  conversationId: string | undefined
  messages: FoxAiMessage[]
  loading: boolean
  streamingContent: string
  evaluationId: string | undefined
  error: string | null
  /** Incrementado ao iniciar nova conversa / forçar reset de UI local (ex.: input). */
  sessionVersion: number

  setEvaluationId: (id: string | undefined) => void
  /**
   * Hidrata a sessão a partir do histórico (sidebar).
   * Não sobrescreve enquanto um stream da mesma conversa estiver ativo.
   */
  hydrateConversation: (
    id: string | undefined,
    messages: FoxAiMessage[]
  ) => void
  /** Nova conversa — cancela stream em andamento e limpa o estado. */
  startNewConversation: () => void
  sendMessage: (args: SendMessageArgs) => Promise<void>
}

export const useFoxAiChatStore = create<FoxAiChatStore>((set, get) => ({
  conversationId: undefined,
  messages: EMPTY_MESSAGES,
  loading: false,
  streamingContent: '',
  evaluationId: undefined,
  error: null,
  sessionVersion: 0,

  setEvaluationId: (id) => set({ evaluationId: id }),

  hydrateConversation: (id, messages) => {
    const { loading, conversationId } = get()
    // Stream em andamento da mesma conversa: UI já tem o estado parcial.
    if (loading && conversationId === id) return
    // Stream em andamento de outra sessão: não troca o contexto ativo.
    if (loading) return

    set({
      conversationId: id,
      messages: messages.length > 0 ? messages : EMPTY_MESSAGES,
      error: null,
      streamingContent: '',
    })
  },

  startNewConversation: () => {
    abortController?.abort()
    abortController = null
    set({
      conversationId: undefined,
      messages: EMPTY_MESSAGES,
      loading: false,
      streamingContent: '',
      evaluationId: undefined,
      error: null,
      sessionVersion: get().sessionVersion + 1,
    })
  },

  sendMessage: async ({
    text,
    dashboardContext,
    queryClient,
    onConversationChange,
  }) => {
    const trimmed = text.trim()
    if (!trimmed || get().loading) return

    const { conversationId, evaluationId } = get()

    set({
      error: null,
      loading: true,
      streamingContent: '',
    })

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

    set({
      messages: [...get().messages, optimisticUser, optimisticAssistant],
    })

    abortController?.abort()
    const controller = new AbortController()
    abortController = controller

    try {
      await streamFoxAiMessage(
        {
          message: trimmed,
          conversationId,
          evaluationId,
          dashboardContext,
        },
        {
          onChunk: (chunk) => {
            const next = get().streamingContent + chunk
            set({
              streamingContent: next,
              messages: get().messages.map((m) =>
                m.id === streamingId ? { ...m, content: next } : m
              ),
            })
          },
          onDone: (result) => {
            set({
              conversationId: result.conversationId,
              messages: [
                ...get().messages.filter(
                  (m) => m.id !== optimisticUser.id && m.id !== streamingId
                ),
                result.userMessage,
                result.assistantMessage,
              ],
              streamingContent: '',
            })
            onConversationChange?.(result.conversationId)
            void queryClient?.invalidateQueries({
              queryKey: ['fox-ai', 'conversations'],
            })
            void queryClient?.invalidateQueries({
              queryKey: ['fox-ai', 'conversation', result.conversationId],
            })
          },
          onError: (message) => {
            if (controller.signal.aborted) return
            set({
              messages: get().messages.filter(
                (m) => m.id !== optimisticUser.id && m.id !== streamingId
              ),
              streamingContent: '',
              error: message,
            })
          },
        },
        controller.signal
      )
    } catch (err) {
      // AbortError ao iniciar nova conversa — ignora.
      if (!controller.signal.aborted) {
        const message =
          err instanceof Error
            ? err.message
            : 'Não foi possível enviar a mensagem.'
        set({
          messages: get().messages.filter(
            (m) => m.id !== optimisticUser.id && m.id !== streamingId
          ),
          streamingContent: '',
          error: message,
        })
      }
    } finally {
      if (abortController === controller) {
        abortController = null
      }
      // Nova conversa pode ter zerado loading; não reativa se outro stream assumiu.
      if (abortController === null) {
        set({ loading: false })
      }
    }
  },
}))
