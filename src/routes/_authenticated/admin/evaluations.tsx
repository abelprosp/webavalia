import { createFileRoute } from '@tanstack/react-router'
import { AdminEvaluationsPage } from '@/features/admin/evaluations-page'

export const Route = createFileRoute('/_authenticated/admin/evaluations')({
  component: AdminEvaluationsPage,
})
