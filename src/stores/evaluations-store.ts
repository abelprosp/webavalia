import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type EvaluationsStore = {
  total: number
  monthlyCounts: Record<string, number>
  recordEvaluation: () => void
}

const MONTHS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
] as const

function currentMonthKey() {
  return MONTHS[new Date().getMonth()]
}

export const useEvaluationsStore = create<EvaluationsStore>()(
  persist(
    (set, get) => ({
      total: 0,
      monthlyCounts: Object.fromEntries(MONTHS.map((m) => [m, 0])),
      recordEvaluation: () => {
        const month = currentMonthKey()
        const monthlyCounts = { ...get().monthlyCounts }
        monthlyCounts[month] = (monthlyCounts[month] ?? 0) + 1
        set({
          total: get().total + 1,
          monthlyCounts,
        })
      },
    }),
    { name: 'avalia-evaluations' }
  )
)

export { MONTHS }
