import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { fetchMe } from '@/lib/auth-api'
import { LandingPage } from '@/features/marketing/landing-page'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const { auth } = useAuthStore.getState()
    if (auth.user) {
      throw redirect({ to: '/app' })
    }
    try {
      const user = await fetchMe()
      auth.setUser(user)
      throw redirect({ to: '/app' })
    } catch (error) {
      if (error && typeof error === 'object' && 'to' in error) throw error
      // visitante anônimo → landing
    }
  },
  component: LandingPage,
})
