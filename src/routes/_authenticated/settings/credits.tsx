import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { CreditsSettings } from '@/features/settings/credits'

const creditsSearchSchema = z.object({
  payment: z.string().optional(),
  order: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/settings/credits')({
  validateSearch: creditsSearchSchema,
  component: CreditsSettings,
})
