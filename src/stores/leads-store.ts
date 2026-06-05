import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type LeadsStore = {
  unlockedIds: string[]
  unlockLead: (id: string) => void
  isUnlocked: (id: string) => boolean
}

export const useLeadsStore = create<LeadsStore>()(
  persist(
    (set, get) => ({
      unlockedIds: [],
      unlockLead: (id) =>
        set((state) => ({
          unlockedIds: state.unlockedIds.includes(id)
            ? state.unlockedIds
            : [...state.unlockedIds, id],
        })),
      isUnlocked: (id) => get().unlockedIds.includes(id),
    }),
    { name: 'avalia-leads' }
  )
)
