import type { AuthUser } from './auth-api'

export type AccountType = 'pf' | 'pj'

export const ACCOUNT_TYPE_OPTIONS = [
  {
    value: 'pf' as const,
    label: 'Pessoa física',
    description: 'Avalie imóveis e compre créditos de avaliação com IA',
  },
  {
    value: 'pj' as const,
    label: 'Imobiliária / Corretor',
    description: 'Acesso completo: leads, CRM e créditos de avaliação',
  },
]

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  pf: 'Pessoa física',
  pj: 'Imobiliária / Corretor',
}

export function getAccountTypeLabel(value: string) {
  return ACCOUNT_TYPE_LABELS[value as AccountType] ?? value
}

export function isBrokerAccount(user: AuthUser | null | undefined) {
  return user?.accountType === 'pj'
}

export function isPersonalAccount(user: AuthUser | null | undefined) {
  return user?.accountType === 'pf'
}

export function getDisplayName(user: AuthUser) {
  if (user.accountType === 'pj') {
    return user.tradeName || user.companyName || user.name
  }
  return user.name
}
