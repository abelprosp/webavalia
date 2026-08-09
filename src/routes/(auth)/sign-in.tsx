import { z } from 'zod'
import { createFileRoute, redirect, isRedirect } from '@tanstack/react-router'
import { fetchMe } from '@/lib/auth-api'
import { useAuthStore } from '@/stores/auth-store'
import { SignIn } from '@/features/auth/sign-in'

const searchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/(auth)/sign-in')({
  beforeLoad: async () => {
    try {
      const user = await fetchMe()
      useAuthStore.getState().auth.setUser(user)
      throw redirect({ to: '/app' })
    } catch (error) {
      if (isRedirect(error)) throw error
    }
  },
  component: SignIn,
  validateSearch: searchSchema,
})
