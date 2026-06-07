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
  `)

  await pool.query(
    `INSERT INTO platform_settings (key, value) VALUES
      ('trial_evaluations_total', '{"value": 3}'),
      ('default_lead_credits', '{"value": 0}'),
      ('registration_enabled', '{"value": true}')
     ON CONFLICT (key) DO NOTHING`
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
        `INSERT INTO users (name, email, password_hash, role, lead_credits, trial_evaluations_remaining)
         VALUES ($1, $2, $3, 'admin', 999, 999)`,
        [adminName, adminEmail, passwordHash]
      )
      console.log(`Usuário admin criado: ${adminEmail}`)
    }
  }

  console.log('Migrations concluídas.')
}

migrate()
  .catch((err) => {
    console.error('Erro na migration:', err)
    process.exit(1)
  })
  .finally(() => pool.end())
