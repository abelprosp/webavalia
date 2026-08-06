import { createFileRoute } from '@tanstack/react-router'
import { redirectOrphanRoute } from '@/lib/redirect-orphan-route'

export const Route = createFileRoute('/_authenticated/tasks/')({
  beforeLoad: redirectOrphanRoute,
})
