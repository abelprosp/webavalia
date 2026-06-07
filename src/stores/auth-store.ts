import { create } from 'zustand'
import { syncCreditsFromUser } from '@/stores/credits-store'
import { logoutRequest } from '@/lib/auth-api'
import type { AuthUser } from '@/lib/auth-api'

interface AuthState {
  auth: {
    user: AuthUser | null
    setUser: (user: AuthUser | null) => void
    updateTrialEvaluationsRemaining: (remaining: number) => void
    reset: (options?: { skipServer?: boolean }) => void
  }
}

export const useAuthStore = create<AuthState>()((set) => ({
  auth: {
    user: null,
    setUser: (user) => {
      if (user) syncCreditsFromUser(user.leadCredits ?? 0)
      set((state) => ({ ...state, auth: { ...state.auth, user } }))
    },
    updateTrialEvaluationsRemaining: (remaining) =>
      set((state) => ({
        ...state,
        auth: {
          ...state.auth,
          user: state.auth.user
            ? { ...state.auth.user, trialEvaluationsRemaining: remaining }
            : null,
        },
      })),
    reset: (options) => {
      if (!options?.skipServer) {
        void logoutRequest().catch(() => undefined)
      }
      set((state) => ({
        ...state,
        auth: { ...state.auth, user: null },
      }))
    },
  },
}))
