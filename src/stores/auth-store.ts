import { create } from 'zustand'
import { emitCreditsUpdated, useCreditsStore } from '@/stores/credits-store'
import { logoutRequest, type AuthUser } from '@/lib/auth-api'

function resolveUserCredits(user: AuthUser) {
  return user.credits ?? user.leadCredits ?? user.trialEvaluationsRemaining ?? 0
}

interface AuthState {
  auth: {
    user: AuthUser | null
    setUser: (user: AuthUser | null) => void
    updateCredits: (credits: number) => void
    /** @deprecated Use updateCredits */
    updateTrialEvaluationsRemaining: (remaining: number) => void
    reset: (options?: { skipServer?: boolean }) => void
  }
}

export const useAuthStore = create<AuthState>()((set) => ({
  auth: {
    user: null,
    setUser: (user) => {
      if (user) emitCreditsUpdated(resolveUserCredits(user))
      set((state) => ({ ...state, auth: { ...state.auth, user } }))
    },
    updateCredits: (credits) => {
      emitCreditsUpdated(credits)
      set((state) => ({
        ...state,
        auth: {
          ...state.auth,
          user: state.auth.user
            ? {
                ...state.auth.user,
                credits,
                leadCredits: credits,
                trialEvaluationsRemaining: credits,
              }
            : null,
        },
      }))
    },
    updateTrialEvaluationsRemaining: (remaining) => {
      emitCreditsUpdated(remaining)
      set((state) => ({
        ...state,
        auth: {
          ...state.auth,
          user: state.auth.user
            ? {
                ...state.auth.user,
                credits: remaining,
                leadCredits: remaining,
                trialEvaluationsRemaining: remaining,
              }
            : null,
        },
      }))
    },
    reset: (options) => {
      if (!options?.skipServer) {
        void logoutRequest().catch(() => undefined)
      }
      useCreditsStore.getState().reset()
      set((state) => ({
        ...state,
        auth: { ...state.auth, user: null },
      }))
    },
  },
}))
