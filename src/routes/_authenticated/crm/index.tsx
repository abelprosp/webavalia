import { createFileRoute, redirect } from '@tanstack/react-router'
import { Crm } from '@/features/crm'
import { isBrokerAccount } from '@/lib/auth-api'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated/crm/')({
  beforeLoad: () => {
    const user = useAuthStore.getState().auth.user
    if (user && !isBrokerAccount(user)) {
      throw redirect({ to: '/' })
    }
  },
  component: Crm,
})
