import { create } from 'zustand'

export const EVALUATION_CREDIT_COST = 5
export const LEAD_UNLOCK_CREDIT_COST = 2

export const CREDITS_UPDATED_EVENT = 'credits:updated'
export const MY_EVALUATIONS_UPDATED_EVENT = 'evaluations:updated'

type CreditsStore = {
  credits: number
  setCredits: (amount: number) => void
  addCredits: (amount: number) => void
  consumeCredits: (amount: number) => boolean
  getLeadUnlockCost: () => number
  getEvaluationCost: () => number
  reset: () => void
}

export const useCreditsStore = create<CreditsStore>()((set, get) => ({
  credits: 0,
  setCredits: (amount) => set({ credits: Math.max(0, amount) }),
  addCredits: (amount) => set({ credits: Math.max(0, get().credits + amount) }),
  consumeCredits: (amount) => {
    if (get().credits >= amount) {
      set({ credits: get().credits - amount })
      return true
    }
    return false
  },
  getLeadUnlockCost: () => LEAD_UNLOCK_CREDIT_COST,
  getEvaluationCost: () => EVALUATION_CREDIT_COST,
  reset: () => set({ credits: 0 }),
}))

/** Sincroniza o saldo unificado a partir do usuário autenticado (fonte: servidor). */
export function syncCreditsFromUser(credits: number) {
  useCreditsStore.getState().setCredits(credits)
}

/** Atualiza store + dispara evento para header/wallet/marketplace. */
export function emitCreditsUpdated(balance: number) {
  syncCreditsFromUser(balance)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(CREDITS_UPDATED_EVENT, { detail: { balance } })
    )
  }
}

/** Notifica telas de listagem (Minhas avaliações) para refetch. */
export function emitMyEvaluationsUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(MY_EVALUATIONS_UPDATED_EVENT))
  }
}
