import type { AccountType } from '../constants/account-type.js'
import { getSetting } from './settings-service.js'

export type UserRow = {
  id: string
  name: string
  email: string
  role: string
  status: string
  account_type: AccountType
  document: string | null
  company_name: string | null
  trade_name: string | null
  credits: number
  evaluations_used: number
  session_version: number
  email_verified: boolean
  efi_subscription_id: string | null
  created_at: Date | string
  updated_at?: Date | string
}

export async function mapUserResponse(row: UserRow) {
  const signupBonus = await getSetting<number>('trial_evaluations_total', 3)

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    accountType: row.account_type,
    document: row.document,
    companyName: row.company_name,
    tradeName: row.trade_name,
    emailVerified: row.email_verified,
    credits: row.credits,
    // Aliases de compatibilidade (mesmo saldo unificado)
    leadCredits: row.credits,
    trialEvaluationsRemaining: row.credits,
    trialEvaluationsTotal: signupBonus,
    evaluationsUsed: row.evaluations_used,
    hasActiveSubscription: Boolean(row.efi_subscription_id),
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : row.created_at,
  }
}

export const USER_SELECT_FIELDS = `
  id, name, email, role, status, account_type, document, company_name,
  trade_name, email_verified, credits, evaluations_used, session_version,
  efi_subscription_id, created_at, updated_at
`
