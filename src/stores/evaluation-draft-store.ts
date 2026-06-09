import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { EvaluationFormValues } from '@/features/avaliacao/data/evaluation-engine'

export type EvaluationDraft = {
  userId: string
  values: EvaluationFormValues
  updatedAt: string
}

type EvaluationDraftStore = {
  draft: EvaluationDraft | null
  saveDraft: (userId: string, values: EvaluationFormValues) => void
  getDraftForUser: (userId: string) => EvaluationDraft | null
  clearDraft: (userId: string) => void
}

export const useEvaluationDraftStore = create<EvaluationDraftStore>()(
  persist(
    (set, get) => ({
      draft: null,

      saveDraft: (userId, values) => {
        set({
          draft: {
            userId,
            values,
            updatedAt: new Date().toISOString(),
          },
        })
      },

      getDraftForUser: (userId) => {
        const draft = get().draft
        return draft?.userId === userId ? draft : null
      },

      clearDraft: (userId) => {
        const draft = get().draft
        if (draft?.userId === userId) {
          set({ draft: null })
        }
      },
    }),
    { name: 'avalia-evaluation-draft' }
  )
)
