import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { VerifyPhonePage } from '@/features/auth/verify-phone'

const searchSchema = z.object({
  email: z.string().optional(),
})

export const Route = createFileRoute('/(auth)/verify-phone')({
  validateSearch: searchSchema,
  component: VerifyPhonePage,
})
