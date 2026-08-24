import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { isBrokerAccount } from '@/lib/auth-api'
import { Radar } from '@/features/radar'

export const Route = createFileRoute('/_authenticated/radar/')({
  beforeLoad: () => {
    const user = useAuthStore.getState().auth.user
    if (user && !isBrokerAccount(user)) {
      throw redirect({ to: '/app' })
    }
  },
  component: Radar,
})
