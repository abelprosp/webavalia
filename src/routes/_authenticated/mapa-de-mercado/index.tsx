import { createFileRoute, redirect } from '@tanstack/react-router'
import { MapaMercado } from '@/features/mapa-mercado'
import { isBrokerAccount } from '@/lib/auth-api'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated/mapa-de-mercado/')({
  beforeLoad: () => {
    const user = useAuthStore.getState().auth.user
    if (user && !isBrokerAccount(user)) {
      throw redirect({ to: '/app' })
    }
  },
  component: MapaMercado,
})
