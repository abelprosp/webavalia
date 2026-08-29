import { createFileRoute, redirect } from '@tanstack/react-router'
import { FOX_AI_ENABLED } from '@/lib/feature-flags'
import { FoxAiChatPage } from '@/features/fox-ai/chat-page'

export const Route = createFileRoute('/_authenticated/fox-ai/chat')({
  beforeLoad: () => {
    if (!FOX_AI_ENABLED) {
      throw redirect({ to: '/app' })
    }
  },
  component: FoxAiChatPage,
})
