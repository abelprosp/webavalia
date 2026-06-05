import { z } from 'zod'

export const leadSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  email: z.string(),
  propertyType: z.string(),
  interest: z.string(),
  budget: z.string(),
  location: z.string(),
  source: z.string(),
  receivedAt: z.date(),
  status: z.enum(['novo', 'desbloqueado', 'contatado']),
})

export type Lead = z.infer<typeof leadSchema>
