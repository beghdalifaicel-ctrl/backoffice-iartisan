-- iArtisan — Orchestrator v1 schema migration
-- Date: 2026-05-01
-- Purpose: support new orchestrator architecture (agent_tasks + unified chat_history)
--
-- Idempotent: safe to re-run. Wraps in BEGIN/COMMIT.

BEGIN;

-- ─────────────────────────────────────────────────────────────────
-- 1) agent_tasks: tasks programmées exécutées par le worker
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_tasks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agent_type      text NOT NULL CHECK (agent_type IN ('ADMIN','MARKETING','COMMERCIAL')),
  intent          text NOT NULL,                        -- e.g. 'post_gmb', 'payment_reminder', 'qualify_lead'
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,   -- args for the executor
  scheduled_at    timestamptz NOT NULL DEFAULT now(),
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','running','completed','error','cancelled')),
  attempts        int NOT NULL DEFAULT 0,
  max_attempts    int NOT NULL DEFAULT 3,
  error_message   text,
  result          jsonb,                                -- artefact returned by the executor
  notify_phone    text,                                 -- WhatsApp number to notify on completion
  created_by_message_id text,                           -- chat_history reference
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_due
  ON agent_tasks (status, scheduled_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_agent_tasks_client
  ON agent_tasks (client_id, status, scheduled_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION agent_tasks_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agent_tasks_updated_at ON agent_tasks;
CREATE TRIGGER trg_agent_tasks_updated_at
  BEFORE UPDATE ON agent_tasks
  FOR EACH ROW EXECUTE FUNCTION agent_tasks_set_updated_at();

-- ─────────────────────────────────────────────────────────────────
-- 2) chat_history: ADD agent_signed_as (additive — no rename)
--
-- Race-free strategy:
--   - We DO NOT rename agent_type. The old v3 code is gone after deploy
--     but if any in-flight request still uses it, it keeps working.
--   - We add agent_signed_as as a NEW column.
--   - We backfill agent_signed_as from agent_type for existing rows
--     so the orchestrator can read legacy history seamlessly.
--   - agent_type can be dropped in a later migration once we're sure
--     no client code references it.
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE chat_history
  ADD COLUMN IF NOT EXISTS agent_signed_as text;

-- Backfill: copy agent_type into agent_signed_as for legacy rows
UPDATE chat_history
   SET agent_signed_as = agent_type
 WHERE agent_signed_as IS NULL
   AND agent_type IS NOT NULL;

-- New unified read index (used by the orchestrator's getSharedHistory)
CREATE INDEX IF NOT EXISTS idx_chat_history_unified
  ON chat_history (client_id, phone, created_at DESC);

-- ─────────────────────────────────────────────────────────────────
-- 3) RPC for the worker: claim N due tasks atomically
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION claim_due_agent_tasks(p_limit int DEFAULT 20)
RETURNS SETOF agent_tasks
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
    UPDATE agent_tasks
       SET status = 'running',
           attempts = attempts + 1
     WHERE id IN (
        SELECT id FROM agent_tasks
         WHERE status = 'pending'
           AND scheduled_at <= now()
         ORDER BY scheduled_at ASC
         LIMIT p_limit
         FOR UPDATE SKIP LOCKED
     )
     RETURNING *;
END;
$$;

COMMIT;
