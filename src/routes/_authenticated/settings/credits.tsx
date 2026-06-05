import { createFileRoute } from '@tanstack/react-router'
import { CreditsSettings } from '@/features/settings/credits'

export const Route = createFileRoute('/_authenticated/settings/credits')({
  component: CreditsSettings,
})
