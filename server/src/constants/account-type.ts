export const ACCOUNT_TYPES = ['pf', 'pj'] as const

export type AccountType = (typeof ACCOUNT_TYPES)[number]

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  pf: 'Pessoa física',
  pj: 'Imobiliária / Corretor',
}

export function getAccountTypeLabel(value: string) {
  return ACCOUNT_TYPE_LABELS[value as AccountType] ?? value
}

export function isBrokerAccountType(value: string) {
  return value === 'pj'
}
