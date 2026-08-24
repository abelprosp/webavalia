import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { fetchMe } from '@/lib/auth-api'
import { getAuthRedirectPath } from '@/lib/redirect-path'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    const { auth } = useAuthStore.getState()

    try {
      const user = await fetchMe()
      auth.setUser(user)
    } catch {
      auth.reset({ skipServer: true })
      throw redirect({
        to: '/sign-in',
        search: {
          redirect: getAuthRedirectPath(location),
        },
      })
    }
  },
  component: AuthenticatedLayout,
})
