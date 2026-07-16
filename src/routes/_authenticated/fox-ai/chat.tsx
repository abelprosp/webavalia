import { createFileRoute } from '@tanstack/react-router'
import { FoxAiChatPage } from '@/features/fox-ai/chat-page'

export const Route = createFileRoute('/_authenticated/fox-ai/chat')({
  component: FoxAiChatPage,
})
