import { createFileRoute, redirect } from '@tanstack/react-router'
import { fetchMe, isAdmin } from '@/lib/auth-api'
import { useAuthStore } from '@/stores/auth-store'
import { AdminLayout } from '@/features/admin/layout'

export const Route = createFileRoute('/_authenticated/admin')({
  beforeLoad: async () => {
    const { auth } = useAuthStore.getState()

    if (!auth.user) {
      try {
        const user = await fetchMe()
        auth.setUser(user)
      } catch {
        auth.reset({ skipServer: true })
        throw redirect({ to: '/sign-in' })
      }
    }

    if (!isAdmin(auth.user)) {
      throw redirect({ to: '/403' })
    }
  },
  component: AdminLayout,
})
