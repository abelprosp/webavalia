import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { isBrokerAccount } from '@/lib/auth-api'
import { Crm } from '@/features/crm'

export const Route = createFileRoute('/_authenticated/minhas-avaliacoes/')({
  beforeLoad: () => {
    const user = useAuthStore.getState().auth.user
    if (user && isBrokerAccount(user)) {
      throw redirect({ to: '/crm' })
    }
  },
  component: () => <Crm personalMode />,
})
