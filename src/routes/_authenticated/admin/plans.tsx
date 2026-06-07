import { createFileRoute } from '@tanstack/react-router'
import { AdminPlansPage } from '@/features/admin/plans-page'

export const Route = createFileRoute('/_authenticated/admin/plans')({
  component: AdminPlansPage,
})
