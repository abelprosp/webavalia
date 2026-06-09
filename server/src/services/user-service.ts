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
  lead_credits: number
  trial_evaluations_remaining: number
  evaluations_used: number
  session_version: number
  email_verified: boolean
  created_at: Date | string
  updated_at?: Date | string
}

export async function mapUserResponse(row: UserRow) {
  const trialEvaluationsTotal = await getSetting<number>(
    'trial_evaluations_total',
    3
  )

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
    leadCredits: row.lead_credits,
    trialEvaluationsRemaining: row.trial_evaluations_remaining,
    trialEvaluationsTotal,
    evaluationsUsed: row.evaluations_used,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : row.created_at,
  }
}

export const USER_SELECT_FIELDS = `
  id, name, email, role, status, account_type, document, company_name,
  trade_name, email_verified, lead_credits, trial_evaluations_remaining,
  evaluations_used, session_version, created_at, updated_at
`
