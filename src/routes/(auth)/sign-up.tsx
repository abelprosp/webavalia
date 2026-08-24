import { createFileRoute, redirect, isRedirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { fetchMe } from '@/lib/auth-api'
import { SignUp } from '@/features/auth/sign-up'

export const Route = createFileRoute('/(auth)/sign-up')({
  beforeLoad: async () => {
    try {
      const user = await fetchMe()
      useAuthStore.getState().auth.setUser(user)
      throw redirect({ to: '/app' })
    } catch (error) {
      if (isRedirect(error)) throw error
    }
  },
  component: SignUp,
})
