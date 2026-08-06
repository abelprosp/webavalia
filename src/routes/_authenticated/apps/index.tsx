import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { redirectOrphanRoute } from '@/lib/redirect-orphan-route'

const appsSearchSchema = z.object({
  type: z
    .enum(['all', 'connected', 'notConnected'])
    .optional()
    .catch(undefined),
  filter: z.string().optional().catch(''),
  sort: z.enum(['asc', 'desc']).optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/apps/')({
  validateSearch: appsSearchSchema,
  beforeLoad: redirectOrphanRoute,
})
