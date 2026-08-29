import { createFileRoute, redirect } from '@tanstack/react-router'
import { FOX_AI_ENABLED } from '@/lib/feature-flags'
import { FoxAiPage } from '@/features/fox-ai'

export const Route = createFileRoute('/_authenticated/fox-ai/')({
  beforeLoad: () => {
    if (!FOX_AI_ENABLED) {
      throw redirect({ to: '/app' })
    }
  },
  component: FoxAiPage,
})
