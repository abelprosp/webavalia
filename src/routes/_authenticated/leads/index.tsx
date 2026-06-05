import { createFileRoute } from '@tanstack/react-router'
import { Leads } from '@/features/leads'

export const Route = createFileRoute('/_authenticated/leads/')({
  component: Leads,
})
