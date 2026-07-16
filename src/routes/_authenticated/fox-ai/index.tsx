import { createFileRoute } from '@tanstack/react-router'
import { FoxAiPage } from '@/features/fox-ai'

export const Route = createFileRoute('/_authenticated/fox-ai/')({
  component: FoxAiPage,
})
