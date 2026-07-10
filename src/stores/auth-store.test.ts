import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth-api', () => ({
  logoutRequest: vi.fn().mockResolvedValue(undefined),
}))

async function importAuthStore() {
  const { useAuthStore } = await import('./auth-store')
  return useAuthStore
}

const sampleUser = {
  id: 'user-1',
  name: 'User Test',
  email: 'user@example.com',
  role: 'corretor',
  accountType: 'pf' as const,
  credits: 3,
  leadCredits: 3,
  trialEvaluationsRemaining: 3,
  trialEvaluationsTotal: 2,
}

describe('useAuthStore', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('starts without a signed-in user', async () => {
    const useAuthStore = await importAuthStore()

    expect(useAuthStore.getState().auth.user).toBeNull()
  })

  it('updates the signed-in user via setUser', async () => {
    const useAuthStore = await importAuthStore()

    useAuthStore.getState().auth.setUser({ ...sampleUser })

    expect(useAuthStore.getState().auth.user).toEqual(sampleUser)
  })

  it('reset clears user state', async () => {
    const useAuthStore = await importAuthStore()
    useAuthStore.getState().auth.setUser({ ...sampleUser })

    useAuthStore.getState().auth.reset({ skipServer: true })

    expect(useAuthStore.getState().auth.user).toBeNull()
  })
})
