import { redirect } from '@tanstack/react-router'

export function redirectOrphanRoute() {
  throw redirect({ to: '/app' })
}
