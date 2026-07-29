type StandardLevel = 'padrao' | 'alto-padrao' | 'luxo'

const MONTHLY_YIELD_BY_STANDARD: Record<StandardLevel, number> = {
  padrao: 0.005,
  'alto-padrao': 0.0045,
  luxo: 0.004,
}

export function estimateMonthlyRent(
  estimatedValue: number,
  standardLevel: StandardLevel,
  area: number
) {
  const monthlyYield = MONTHLY_YIELD_BY_STANDARD[standardLevel] ?? 0.005
  const monthlyRent = Math.round(estimatedValue * monthlyYield)
  const rentPerSqm = area > 0 ? Math.round(monthlyRent / area) : 0
  const annualYieldPercent = monthlyYield * 12 * 100

  return { monthlyRent, rentPerSqm, annualYieldPercent, monthlyYield }
}

export function getListingIntentFromInput(
  propertyInput: Record<string, unknown> | null | undefined
): 'alugar' | 'vender' {
  return propertyInput?.listingIntent === 'alugar' ? 'alugar' : 'vender'
}

export function getLeadInterestLabel(listingIntent: 'alugar' | 'vender') {
  return listingIntent === 'alugar'
    ? 'Proprietário interessado em alugar'
    : 'Proprietário interessado em vender'
}

export function formatLeadBudget(
  listingIntent: 'alugar' | 'vender',
  estimatedValue: number,
  propertyInput: Record<string, unknown> | null | undefined
) {
  if (listingIntent === 'alugar') {
    const standardLevel =
      propertyInput?.standardLevel === 'alto-padrao' ||
      propertyInput?.standardLevel === 'luxo'
        ? propertyInput.standardLevel
        : 'padrao'
    const area =
      typeof propertyInput?.area === 'number' ? propertyInput.area : 0
    const rental = estimateMonthlyRent(estimatedValue, standardLevel, area)
    return `${rental.monthlyRent.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    })}/mês`
  }

  return estimatedValue.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}
