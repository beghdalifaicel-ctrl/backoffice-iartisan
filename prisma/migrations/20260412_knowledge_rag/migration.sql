-- ============================================================
-- iArtisan Knowledge Base + RAG + Agent Instructions
-- Migration: 20260412_knowledge_rag
-- ============================================================

-- 1. Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add custom instructions & personality to agent_configs
ALTER TABLE agent_configs
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS instructions TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS personality JSONB DEFAULT '{
    "tone": "professionnel",
    "tutoiement": false,
    "signature": "",
    "langue": "fr",
    "restrictions": []
  }';

COMMENT ON COLUMN agent_configs.instructions IS 'Custom system instructions appended to base prompt. E.g. "Toujours proposer un RDV", "Ne jamais faire de remise"';
COMMENT ON COLUMN agent_configs.personality IS 'Personality settings: tone, tutoiement, signature, restrictions, custom rules';

-- 3. Knowledge documents — uploaded files (PDF, CSV, text, etc.)
CREATE TABLE knowledge_documents (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- Metadata
  name TEXT NOT NULL,                                      -- "Grille tarifaire 2026"
  description TEXT DEFAULT '',                             -- Optional description
  file_type TEXT NOT NULL DEFAULT 'text',                  -- text, pdf, csv, html
  file_url TEXT,                                           -- Supabase storage URL (optional)
  file_size_bytes INTEGER DEFAULT 0,

  -- Scope: which agents can use this document
  agent_types TEXT[] DEFAULT ARRAY['ADMIN', 'MARKETING', 'COMMERCIAL'],

  -- Processing status
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PROCESSING', 'READY', 'ERROR')),
  chunk_count INTEGER DEFAULT 0,
  error TEXT,

  -- Content hash for deduplication
  content_hash TEXT
);

-- 4. Knowledge chunks — embedded text fragments for RAG retrieval
CREATE TABLE knowledge_chunks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  created_at TIMESTAMPTZ DEFAULT now(),
  document_id TEXT NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- Content
  content TEXT NOT NULL,                                   -- The chunk text
  chunk_index INTEGER NOT NULL DEFAULT 0,                  -- Position in document

  -- Metadata for filtering
  agent_types TEXT[] DEFAULT ARRAY['ADMIN', 'MARKETING', 'COMMERCIAL'],
  metadata JSONB DEFAULT '{}',                             -- Section title, page number, etc.

  -- Vector embedding (Mistral embed = 1024 dimensions)
  embedding vector(1024),

  -- Token count for context window budget
  token_count INTEGER DEFAULT 0
);

-- 5. Indexes for performance

-- Document queries
CREATE INDEX idx_knowledge_docs_client ON knowledge_documents(client_id);
CREATE INDEX idx_knowledge_docs_status ON knowledge_documents(client_id, status);
CREATE INDEX idx_knowledge_docs_agents ON knowledge_documents USING GIN(agent_types);

-- Chunk queries
CREATE INDEX idx_knowledge_chunks_doc ON knowledge_chunks(document_id);
CREATE INDEX idx_knowledge_chunks_client ON knowledge_chunks(client_id);

-- Vector similarity search (IVFFlat for fast approximate search)
-- We use ivfflat with cosine distance — good balance of speed and accuracy
-- lists = sqrt(estimated_rows), start with 100 for <10K chunks
CREATE INDEX idx_knowledge_chunks_embedding
  ON knowledge_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Agent type filtering on chunks
CREATE INDEX idx_knowledge_chunks_agents ON knowledge_chunks USING GIN(agent_types);

-- 6. RPC function for semantic search with agent type filtering
CREATE OR REPLACE FUNCTION search_knowledge(
  p_client_id TEXT,
  p_agent_type TEXT,
  p_query_embedding vector(1024),
  p_match_count INTEGER DEFAULT 5,
  p_match_threshold FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  id TEXT,
  document_id TEXT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT,
  document_name TEXT,
  token_count INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.document_id,
    kc.content,
    kc.metadata,
    1 - (kc.embedding <=> p_query_embedding) AS similarity,
    kd.name AS document_name,
    kc.token_count
  FROM knowledge_chunks kc
  JOIN knowledge_documents kd ON kd.id = kc.document_id
  WHERE
    kc.client_id = p_client_id
    AND p_agent_type = ANY(kc.agent_types)
    AND kd.status = 'READY'
    AND 1 - (kc.embedding <=> p_query_embedding) > p_match_threshold
  ORDER BY kc.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$;

-- 7. RPC function for getting agent instructions + personality
CREATE OR REPLACE FUNCTION get_agent_full_config(
  p_client_id TEXT,
  p_agent_type TEXT
)
RETURNS TABLE (
  display_name TEXT,
  instructions TEXT,
  personality JSONB,
  settings JSONB,
  enabled BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ac.display_name,
    ac.instructions,
    ac.personality,
    ac.settings,
    ac.enabled
  FROM agent_configs ac
  WHERE ac.client_id = p_client_id
    AND ac.agent_type = p_agent_type;
END;
$$;

-- 8. RLS policies
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (used by backend)
CREATE POLICY "service_all_knowledge_docs" ON knowledge_documents
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_all_knowledge_chunks" ON knowledge_chunks
  FOR ALL USING (true) WITH CHECK (true);

-- 9. Storage bucket for document uploads (run manually in Supabase dashboard if needed)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('knowledge', 'knowledge', false);
