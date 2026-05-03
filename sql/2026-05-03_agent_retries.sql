-- Sprint 3-2 — Couche 2 : Auto-correction temps réel
--
-- Stocke chaque retry déclenché par le reflective-validator pour observer :
--   - quelles violations sont les plus fréquentes par agent
--   - si la correction réussit (corrected_reply ≠ original_reply)
--   - alimentation future de Couche 1 (lessons learned validées)
--
-- À exécuter dans Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS agent_retries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text REFERENCES clients(id) ON DELETE CASCADE,
  phone text NOT NULL,
  agent_signed_as text NOT NULL CHECK (agent_signed_as IN ('ADMIN', 'MARKETING', 'COMMERCIAL')),
  user_message text NOT NULL,
  original_reply text NOT NULL,
  violations jsonb NOT NULL DEFAULT '[]'::jsonb,
  correction_hint text,
  corrected_reply text,
  retry_index integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_retries_client_created
  ON agent_retries(client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_retries_agent_created
  ON agent_retries(agent_signed_as, created_at DESC);

-- Index GIN pour requêter les violations par type (ex: stats hallucinations)
CREATE INDEX IF NOT EXISTS idx_agent_retries_violations
  ON agent_retries USING gin(violations);

ALTER TABLE agent_retries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role full access agent_retries" ON agent_retries;
CREATE POLICY "service_role full access agent_retries"
  ON agent_retries
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Vue pratique pour monitoring quotidien
CREATE OR REPLACE VIEW agent_retries_daily_stats AS
SELECT
  date_trunc('day', created_at) AS day,
  agent_signed_as,
  COUNT(*) AS total_retries,
  COUNT(*) FILTER (
    WHERE violations @> '[{"type":"temporal_promise_no_tool"}]'::jsonb
  ) AS temporal_promise,
  COUNT(*) FILTER (
    WHERE violations @> '[{"type":"speak_for_other_agent"}]'::jsonb
  ) AS speak_for_other,
  COUNT(*) FILTER (
    WHERE violations @> '[{"type":"mention_other_agent"}]'::jsonb
  ) AS mention_other,
  COUNT(*) FILTER (
    WHERE violations @> '[{"type":"out_of_scope"}]'::jsonb
  ) AS out_of_scope,
  COUNT(*) FILTER (
    WHERE violations @> '[{"type":"invented_data"}]'::jsonb
  ) AS invented_data,
  COUNT(*) FILTER (
    WHERE violations @> '[{"type":"invented_capability"}]'::jsonb
  ) AS invented_capability,
  COUNT(*) FILTER (
    WHERE original_reply != corrected_reply
  ) AS effectively_corrected
FROM agent_retries
GROUP BY date_trunc('day', created_at), agent_signed_as
ORDER BY day DESC, agent_signed_as;
