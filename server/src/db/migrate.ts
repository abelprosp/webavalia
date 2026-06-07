import { pool } from './pool.js'

async function migrate() {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";

    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'corretor',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS trial_evaluations_remaining INT NOT NULL DEFAULT 3;

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS evaluations_used INT NOT NULL DEFAULT 0;

    UPDATE users
    SET trial_evaluations_remaining = 3
    WHERE trial_evaluations_remaining IS NULL OR evaluations_used IS NULL;
  `)

  console.log('Migrations concluídas.')
}

migrate()
  .catch((err) => {
    console.error('Erro na migration:', err)
    process.exit(1)
  })
  .finally(() => pool.end())
