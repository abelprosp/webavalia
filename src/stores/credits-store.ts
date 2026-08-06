import { create } from 'zustand'

const CREDIT_COST = 1

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
  setCredits: (amount) => set({ credits: amount }),
  addCredits: (amount) => set({ credits: get().credits + amount }),
  consumeCredits: (amount) => {
    if (get().credits >= amount) {
      set({ credits: get().credits - amount })
      return true
    }
    return false
  },
  getLeadUnlockCost: () => CREDIT_COST,
  getEvaluationCost: () => CREDIT_COST,
  reset: () => set({ credits: 0 }),
}))

/** Sincroniza o saldo unificado a partir do usuário autenticado (fonte: servidor). */
export function syncCreditsFromUser(credits: number) {
  useCreditsStore.getState().setCredits(credits)
}
