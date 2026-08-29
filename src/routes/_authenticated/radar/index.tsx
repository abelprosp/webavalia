import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { isBrokerAccount } from '@/lib/auth-api'
import { CAPTURE_RADAR_ENABLED } from '@/lib/feature-flags'
import { Radar } from '@/features/radar'

export const Route = createFileRoute('/_authenticated/radar/')({
  beforeLoad: () => {
    if (!CAPTURE_RADAR_ENABLED) {
      throw redirect({ to: '/app' })
    }
    const user = useAuthStore.getState().auth.user
    if (user && !isBrokerAccount(user)) {
      throw redirect({ to: '/app' })
    }
  },
  component: Radar,
})
