import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const LEAD_UNLOCK_COST = 1

type CreditsStore = {
  credits: number
  setCredits: (amount: number) => void
  addCredits: (amount: number) => void
  consumeCredits: (amount: number) => boolean
  getLeadUnlockCost: () => number
}

export const useCreditsStore = create<CreditsStore>()(
  persist(
    (set, get) => ({
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
      getLeadUnlockCost: () => LEAD_UNLOCK_COST,
    }),
    { name: 'avalia-credits' }
  )
)

export function syncCreditsFromUser(leadCredits: number) {
  useCreditsStore.getState().setCredits(leadCredits)
}
