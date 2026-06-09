import { createFileRoute, redirect } from '@tanstack/react-router'
import { Leads } from '@/features/leads'
import { isBrokerAccount } from '@/lib/auth-api'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated/leads/')({
  beforeLoad: () => {
    const user = useAuthStore.getState().auth.user
    if (user && !isBrokerAccount(user)) {
      throw redirect({ to: '/' })
    }
  },
  component: Leads,
})
