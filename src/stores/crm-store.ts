import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  EvaluationFormValues,
  EvaluationResult,
} from '@/features/avaliacao/data/evaluation-engine'
import {
  type CrmEvaluation,
  type CrmEvaluationStatus,
  serializeEvaluationResult,
} from '@/features/crm/data/schema'

type SaveEvaluationInput = {
  property: EvaluationFormValues
  result: EvaluationResult
  clientName?: string
  notes?: string
  status?: CrmEvaluationStatus
}

type CrmStore = {
  evaluations: CrmEvaluation[]
  saveEvaluation: (input: SaveEvaluationInput) => string
  removeEvaluation: (id: string) => void
  updateEvaluation: (
    id: string,
    data: Partial<Pick<CrmEvaluation, 'clientName' | 'notes' | 'status'>>
  ) => void
  getEvaluation: (id: string) => CrmEvaluation | undefined
}

function generateId() {
  return `crm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export const useCrmStore = create<CrmStore>()(
  persist(
    (set, get) => ({
      evaluations: [],

      saveEvaluation: ({
        property,
        result,
        clientName,
        notes,
        status = 'novo',
      }) => {
        const id = generateId()
        const entry: CrmEvaluation = {
          id,
          clientName: clientName?.trim() || undefined,
          notes: notes?.trim() || undefined,
          status,
          property,
          result: serializeEvaluationResult(result),
          savedAt: new Date().toISOString(),
        }

        set({ evaluations: [entry, ...get().evaluations] })
        return id
      },

      removeEvaluation: (id) => {
        set({
          evaluations: get().evaluations.filter((e) => e.id !== id),
        })
      },

      updateEvaluation: (id, data) => {
        set({
          evaluations: get().evaluations.map((e) =>
            e.id === id ? { ...e, ...data } : e
          ),
        })
      },

      getEvaluation: (id) => get().evaluations.find((e) => e.id === id),
    }),
    { name: 'avalia-crm' }
  )
)
