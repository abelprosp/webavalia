import { pool } from './pool.js'

let ensured = false

export async function ensureFoxAiTables() {
  if (ensured) return

  await pool.query(`
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
  `)

  ensured = true
}
