import 'dotenv/config'
import { pool } from './pool.js'
import { hashPassword } from '../utils/password.js'

async function migrate() {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";

    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'corretor',
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      lead_credits INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
    CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS trial_evaluations_remaining INT NOT NULL DEFAULT 3;

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS evaluations_used INT NOT NULL DEFAULT 0;

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS lead_credits INT NOT NULL DEFAULT 0;

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS session_version INT NOT NULL DEFAULT 0;

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS asaas_customer_id VARCHAR(255);

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS asaas_subscription_id VARCHAR(255);

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS efi_subscription_id VARCHAR(255);

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS credits INT NOT NULL DEFAULT 0;

    -- Unifica saldos antigos (leads + avaliações) em credits
    UPDATE users
    SET credits = GREATEST(
      COALESCE(lead_credits, 0) + COALESCE(trial_evaluations_remaining, 0),
      credits
    )
    WHERE COALESCE(lead_credits, 0) + COALESCE(trial_evaluations_remaining, 0) > credits;

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS account_type VARCHAR(2) NOT NULL DEFAULT 'pj';

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS document VARCHAR(14);

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS trade_name VARCHAR(255);

    CREATE INDEX IF NOT EXISTS users_account_type_idx ON users (account_type);

    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(64) NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS email_verification_tokens_hash_idx
      ON email_verification_tokens (token_hash);

    CREATE TABLE IF NOT EXISTS plans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      description TEXT,
      price_cents INT NOT NULL DEFAULT 0,
      lead_credits INT NOT NULL DEFAULT 0,
      trial_evaluations INT NOT NULL DEFAULT 3,
      is_active BOOLEAN NOT NULL DEFAULT true,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS platform_settings (
      key VARCHAR(100) PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS credit_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount INT NOT NULL,
      type VARCHAR(50) NOT NULL,
      description TEXT,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS credit_transactions_user_idx
      ON credit_transactions (user_id);

    CREATE TABLE IF NOT EXISTS payment_orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      amount_cents INT NOT NULL,
      packs INT NOT NULL DEFAULT 1,
      abacate_id VARCHAR(255),
      external_id VARCHAR(255) UNIQUE NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      paid_at TIMESTAMPTZ,
      fulfilled_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS payment_orders_user_idx
      ON payment_orders (user_id);

    CREATE INDEX IF NOT EXISTS payment_orders_external_id_idx
      ON payment_orders (external_id);

    CREATE TABLE IF NOT EXISTS webhook_events (
      id VARCHAR(255) PRIMARY KEY,
      event_type VARCHAR(100) NOT NULL,
      processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS auth_login_lockouts (
      email_normalized VARCHAR(255) PRIMARY KEY,
      failed_attempts INT NOT NULL DEFAULT 0,
      locked_until TIMESTAMPTZ,
      last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS auth_attempt_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email_normalized VARCHAR(255) NOT NULL,
      ip_address VARCHAR(45),
      action VARCHAR(30) NOT NULL,
      success BOOLEAN NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS auth_attempt_logs_email_idx
      ON auth_attempt_logs (email_normalized, created_at DESC);

    CREATE INDEX IF NOT EXISTS auth_attempt_logs_ip_idx
      ON auth_attempt_logs (ip_address, created_at DESC);

    CREATE TABLE IF NOT EXISTS property_evaluations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      property_input JSONB NOT NULL,
      evaluation_result JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS property_evaluations_user_idx
      ON property_evaluations (user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS evaluation_feedback (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      evaluation_id UUID NOT NULL UNIQUE REFERENCES property_evaluations(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rating VARCHAR(10) NOT NULL CHECK (rating IN ('good', 'bad')),
      comment TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS evaluation_feedback_rating_idx
      ON evaluation_feedback (rating, created_at DESC);

    CREATE TABLE IF NOT EXISTS blog_posts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug VARCHAR(255) UNIQUE NOT NULL,
      title VARCHAR(500) NOT NULL,
      excerpt TEXT,
      content TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
      author_id UUID REFERENCES users(id) ON DELETE SET NULL,
      published_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS blog_posts_status_published_idx
      ON blog_posts (status, published_at DESC);

    CREATE INDEX IF NOT EXISTS blog_posts_slug_idx
      ON blog_posts (slug);

    CREATE TABLE IF NOT EXISTS fox_ai_conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL DEFAULT 'Nova conversa',
      context_type VARCHAR(50) NOT NULL DEFAULT 'general',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS fox_ai_conversations_user_idx
      ON fox_ai_conversations (user_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS fox_ai_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL REFERENCES fox_ai_conversations(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS fox_ai_messages_conversation_idx
      ON fox_ai_messages (conversation_id, created_at ASC);

    CREATE TABLE IF NOT EXISTS user_achievements (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      achievement_key VARCHAR(50) NOT NULL,
      unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, achievement_key)
    );

    CREATE INDEX IF NOT EXISTS user_achievements_user_idx
      ON user_achievements (user_id, unlocked_at DESC);

    CREATE TABLE IF NOT EXISTS background_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'queued',
      payload JSONB NOT NULL,
      result JSONB,
      error_message TEXT,
      trial_evaluations_remaining INT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS background_jobs_user_idx
      ON background_jobs (user_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS background_jobs_status_idx
      ON background_jobs (status, created_at ASC);

    CREATE TABLE IF NOT EXISTS user_notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      body TEXT,
      link VARCHAR(500),
      metadata JSONB NOT NULL DEFAULT '{}',
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS user_notifications_user_idx
      ON user_notifications (user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS leads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      external_id VARCHAR(255) UNIQUE,
      name VARCHAR(255),
      phone VARCHAR(50) NOT NULL,
      email VARCHAR(255),
      property_type VARCHAR(100),
      interest TEXT,
      budget VARCHAR(100),
      location VARCHAR(500),
      source VARCHAR(50) NOT NULL DEFAULT 'whatsapp',
      status VARCHAR(20) NOT NULL DEFAULT 'novo',
      property_input JSONB,
      evaluation_result JSONB,
      raw_payload JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS leads_created_idx
      ON leads (created_at DESC);

    CREATE INDEX IF NOT EXISTS leads_status_idx
      ON leads (status, created_at DESC);

    CREATE TABLE IF NOT EXISTS lead_unlocks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      credits_spent INT NOT NULL DEFAULT 1,
      unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (lead_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS lead_unlocks_user_idx
      ON lead_unlocks (user_id, unlocked_at DESC);

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS service_regions TEXT[] NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS specialties TEXT[] NOT NULL DEFAULT '{}';

    ALTER TABLE leads
      ADD COLUMN IF NOT EXISTS lead_score JSONB,
      ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES users(id) ON DELETE SET NULL;

    CREATE TABLE IF NOT EXISTS crm_pipelines (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      is_default BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS crm_pipelines_user_idx
      ON crm_pipelines (user_id);

    CREATE TABLE IF NOT EXISTS crm_stages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      pipeline_id UUID NOT NULL REFERENCES crm_pipelines(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(100) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      color VARCHAR(50) NOT NULL DEFAULT 'lavender',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (pipeline_id, slug)
    );

    CREATE INDEX IF NOT EXISTS crm_stages_pipeline_idx
      ON crm_stages (pipeline_id, sort_order);

    CREATE TABLE IF NOT EXISTS crm_deals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      pipeline_id UUID NOT NULL REFERENCES crm_pipelines(id) ON DELETE CASCADE,
      stage_id UUID NOT NULL REFERENCES crm_stages(id) ON DELETE RESTRICT,
      lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
      title VARCHAR(500) NOT NULL,
      client_name VARCHAR(255),
      client_phone VARCHAR(50),
      client_email VARCHAR(255),
      location VARCHAR(500),
      property_type VARCHAR(100),
      notes TEXT,
      assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
      lead_score JSONB,
      tags TEXT[] NOT NULL DEFAULT '{}',
      property_input JSONB,
      evaluation_result JSONB,
      expected_ticket NUMERIC,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS crm_deals_user_idx ON crm_deals (user_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS crm_deals_stage_idx ON crm_deals (stage_id);
    CREATE INDEX IF NOT EXISTS crm_deals_lead_idx ON crm_deals (lead_id);

    CREATE TABLE IF NOT EXISTS crm_activities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      deal_id UUID NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      activity_type VARCHAR(50) NOT NULL,
      title VARCHAR(500) NOT NULL,
      body TEXT,
      metadata JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS crm_activities_deal_idx
      ON crm_activities (deal_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS crm_tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      deal_id UUID NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
      stage_id UUID REFERENCES crm_stages(id) ON DELETE SET NULL,
      title VARCHAR(500) NOT NULL,
      description TEXT,
      due_at TIMESTAMPTZ,
      reminder_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS crm_tasks_deal_idx ON crm_tasks (deal_id, due_at);

    CREATE TABLE IF NOT EXISTS crm_stage_automations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      stage_id UUID NOT NULL REFERENCES crm_stages(id) ON DELETE CASCADE,
      trigger_type VARCHAR(50) NOT NULL DEFAULT 'on_enter',
      action_type VARCHAR(50) NOT NULL,
      action_config JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS lead_assignments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      method VARCHAR(50) NOT NULL DEFAULT 'manual',
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS lead_assignments_lead_idx ON lead_assignments (lead_id);
  `)

  await pool.query(`
    UPDATE users SET email_verified = true WHERE role = 'admin' AND email_verified = false
  `)

  const grandfather = await pool.query(
    `SELECT 1 FROM platform_settings WHERE key = 'email_verification_grandfathered'`
  )
  if (!grandfather.rowCount) {
    await pool.query(`UPDATE users SET email_verified = true WHERE email_verified = false`)
    await pool.query(
      `INSERT INTO platform_settings (key, value)
       VALUES ('email_verification_grandfathered', '{"value": true}')`
    )
  }

  await pool.query(
    `INSERT INTO platform_settings (key, value) VALUES
      ('trial_evaluations_total', '{"value": 2}'),
      ('default_lead_credits', '{"value": 0}'),
      ('registration_enabled', '{"value": true}'),
      ('evaluation_feedback_mode', '{"value": true}'),
      ('gamification_monthly_goal', '{"value": 5}'),
      ('gamification_feedback_reward', '{"value": 0}')
     ON CONFLICT (key) DO NOTHING`
  )

  // Funil gratuito PJ: 2 no cadastro + 1 bônus no primeiro feedback
  await pool.query(
    `UPDATE platform_settings
     SET value = '{"value": 2}'::jsonb, updated_at = NOW()
     WHERE key = 'trial_evaluations_total'`
  )
  await pool.query(
    `UPDATE platform_settings
     SET value = '{"value": 0}'::jsonb, updated_at = NOW()
     WHERE key = 'gamification_feedback_reward'`
  )

  const plansCount = await pool.query('SELECT COUNT(*)::int AS count FROM plans')
  if ((plansCount.rows[0]?.count ?? 0) === 0) {
    await pool.query(
      `INSERT INTO plans (name, description, price_cents, lead_credits, trial_evaluations, is_active, sort_order)
       VALUES
         ('Starter', '10 créditos para desbloquear leads', 4990, 10, 3, true, 1),
         ('Profissional', '25 créditos — plano mais popular', 9990, 25, 5, true, 2),
         ('Agência', '50 créditos para equipes', 17990, 50, 10, true, 3),
         ('Enterprise', '100 créditos + suporte prioritário', 29990, 100, 20, true, 4)`
    )
  }

  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase()
  const adminPassword = process.env.ADMIN_PASSWORD
  const adminName = process.env.ADMIN_NAME ?? 'Administrador'

  if (adminEmail && adminPassword) {
    const existingAdmin = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [adminEmail]
    )

    if (!existingAdmin.rowCount) {
      const passwordHash = await hashPassword(adminPassword)
      await pool.query(
        `INSERT INTO users (name, email, password_hash, role, credits, email_verified)
         VALUES ($1, $2, $3, 'admin', 999, true)`,
        [adminName, adminEmail, passwordHash]
      )
      console.log(`Usuário admin criado: ${adminEmail}`)
    }
  }

  await ensureLocationFloodFeedbackTable()

  console.log('Migrations concluídas.')
}

async function ensureLocationFloodFeedbackTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS location_flood_feedback (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      evaluation_id UUID REFERENCES property_evaluations(id) ON DELETE SET NULL,
      address_key VARCHAR(500) NOT NULL,
      address_display TEXT NOT NULL,
      got_water BOOLEAN NOT NULL,
      severity VARCHAR(20) CHECK (severity IN ('baixo', 'moderado', 'alto') OR severity IS NULL),
      comment TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS location_flood_feedback_address_key_idx
      ON location_flood_feedback (address_key, created_at DESC);
  `)
}

migrate()
  .catch((err) => {
    console.error('Erro na migration:', err)
    process.exit(1)
  })
  .finally(() => pool.end())
