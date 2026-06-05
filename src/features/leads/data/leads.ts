import { type Lead } from './schema'

export const leads: Lead[] = []

export function maskContact(value: string) {
  if (value.length <= 4) return '****'
  return (
    value.slice(0, 2) +
    '*'.repeat(Math.min(value.length - 4, 8)) +
    value.slice(-2)
  )
}
