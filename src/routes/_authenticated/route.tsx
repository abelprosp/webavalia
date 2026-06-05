import { createFileRoute, redirect } from '@tanstack/react-router'
import { fetchMe } from '@/lib/auth-api'
import { getAuthRedirectPath } from '@/lib/redirect-path'
import { useAuthStore } from '@/stores/auth-store'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    const { auth } = useAuthStore.getState()

    if (!auth.accessToken) {
      throw redirect({
        to: '/sign-in',
        search: {
          redirect: getAuthRedirectPath(location),
        },
      })
    }

    if (!auth.user) {
      try {
        const user = await fetchMe()
        auth.setUser(user)
      } catch {
        auth.reset()
        throw redirect({
          to: '/sign-in',
          search: {
            redirect: location.pathname + location.search + location.hash,
          },
        })
      }
    }
  },
  component: AuthenticatedLayout,
})
