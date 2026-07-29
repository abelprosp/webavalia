export type SaleScenarioId = 'rapida' | 'moderada' | 'lenta'

export type SaleScenario = {
  id: SaleScenarioId
  label: string
  description: string
  timeframe: string
  value: number
  valuePerSqm: number
  adjustmentPercent: number
}

/** Ajustes sobre o valor estimado de mercado (NBR 14653). */
export const SALE_SCENARIO_ADJUSTMENTS: Record<SaleScenarioId, number> = {
  rapida: -0.1,
  moderada: 0,
  lenta: 0.08,
}

const SCENARIO_META: Record<
  SaleScenarioId,
  { label: string; description: string; timeframe: string }
> = {
  rapida: {
    label: 'Venda rápida',
    description: 'Preço mais agressivo para atrair compradores',
    timeframe: '30–60 dias',
  },
  moderada: {
    label: 'Venda moderada',
    description: 'Valor alinhado ao mercado',
    timeframe: '3–6 meses',
  },
  lenta: {
    label: 'Venda lenta',
    description: 'Preço otimista — exige mais tempo no mercado',
    timeframe: '6+ meses',
  },
}

export function computeSaleScenarios(
  estimatedValue: number,
  area: number
): SaleScenario[] {
  const safeArea = area > 0 ? area : 1

  return (Object.keys(SALE_SCENARIO_ADJUSTMENTS) as SaleScenarioId[]).map(
    (id) => {
      const adjustmentPercent = SALE_SCENARIO_ADJUSTMENTS[id]
      const value = Math.round(estimatedValue * (1 + adjustmentPercent))
      const meta = SCENARIO_META[id]

      return {
        id,
        label: meta.label,
        description: meta.description,
        timeframe: meta.timeframe,
        value,
        valuePerSqm: Math.round(value / safeArea),
        adjustmentPercent: adjustmentPercent * 100,
      }
    }
  )
}
