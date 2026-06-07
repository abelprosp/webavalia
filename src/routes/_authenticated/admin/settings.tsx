import { createFileRoute } from '@tanstack/react-router'
import { AdminSettingsPage } from '@/features/admin/settings-page'

export const Route = createFileRoute('/_authenticated/admin/settings')({
  component: AdminSettingsPage,
})
