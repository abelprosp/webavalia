import { createFileRoute } from '@tanstack/react-router'
import { TermsOfUsePage } from '@/features/legal/terms-of-use-page'

export const Route = createFileRoute('/termos-de-uso')({
  component: TermsOfUsePage,
})
