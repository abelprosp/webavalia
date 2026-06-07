const MIN_AUTH_RESPONSE_MS = 500

export async function normalizeAuthTiming(startedAt: number) {
  const elapsed = Date.now() - startedAt
  const waitMs = MIN_AUTH_RESPONSE_MS - elapsed

  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs))
  }
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}
