import { createFileRoute } from '@tanstack/react-router'
import { Crm } from '@/features/crm'

export const Route = createFileRoute('/_authenticated/crm/')({
  component: Crm,
})
