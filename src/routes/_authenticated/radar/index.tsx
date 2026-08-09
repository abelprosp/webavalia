import { createFileRoute, redirect } from '@tanstack/react-router'
import { Radar } from '@/features/radar'
import { isBrokerAccount } from '@/lib/auth-api'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated/radar/')({
  beforeLoad: () => {
    const user = useAuthStore.getState().auth.user
    if (user && !isBrokerAccount(user)) {
      throw redirect({ to: '/app' })
    }
  },
  component: Radar,
})
