import { pool } from '../db/pool.js'

type SettingKey =
  | 'trial_evaluations_total'
  | 'default_lead_credits'
  | 'registration_enabled'

const DEFAULTS: Record<SettingKey, unknown> = {
  trial_evaluations_total: 3,
  default_lead_credits: 0,
  registration_enabled: true,
}

export async function getSetting<T>(key: SettingKey, fallback?: T): Promise<T> {
  const result = await pool.query<{ value: unknown }>(
    'SELECT value FROM platform_settings WHERE key = $1',
    [key]
  )

  if (!result.rowCount) {
    return (fallback ?? DEFAULTS[key]) as T
  }

  const raw = result.rows[0].value
  if (typeof raw === 'object' && raw !== null && 'value' in raw) {
    return (raw as { value: T }).value
  }

  return raw as T
}

export async function setSetting(key: SettingKey, value: unknown) {
  await pool.query(
    `INSERT INTO platform_settings (key, value, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE
     SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, JSON.stringify({ value })]
  )
}

export async function getPlatformSettings() {
  const [trialEvaluationsTotal, defaultLeadCredits, registrationEnabled] =
    await Promise.all([
      getSetting<number>('trial_evaluations_total'),
      getSetting<number>('default_lead_credits'),
      getSetting<boolean>('registration_enabled'),
    ])

  return {
    trialEvaluationsTotal,
    defaultLeadCredits,
    registrationEnabled,
  }
}

export async function updatePlatformSettings(input: {
  trialEvaluationsTotal?: number
  defaultLeadCredits?: number
  registrationEnabled?: boolean
}) {
  if (input.trialEvaluationsTotal != null) {
    await setSetting('trial_evaluations_total', input.trialEvaluationsTotal)
  }
  if (input.defaultLeadCredits != null) {
    await setSetting('default_lead_credits', input.defaultLeadCredits)
  }
  if (input.registrationEnabled != null) {
    await setSetting('registration_enabled', input.registrationEnabled)
  }

  return getPlatformSettings()
}
