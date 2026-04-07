-- Agent configurations per client
CREATE TABLE agent_configs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('ADMIN', 'MARKETING', 'COMMERCIAL')),
  enabled BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}',
  UNIQUE(client_id, agent_type)
);

-- Task queue for agents
CREATE TABLE agent_tasks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('ADMIN', 'MARKETING', 'COMMERCIAL')),
  task_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  priority INTEGER DEFAULT 0,
  payload JSONB DEFAULT '{}',
  result JSONB,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  scheduled_for TIMESTAMPTZ DEFAULT now()
);

-- Execution logs for billing/debugging
CREATE TABLE agent_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  created_at TIMESTAMPTZ DEFAULT now(),
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL,
  task_id TEXT REFERENCES agent_tasks(id),
  action TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  model_used TEXT,
  duration_ms INTEGER,
  cost_cents INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'
);

-- Usage quotas per client per billing period
CREATE TABLE agent_quotas (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  tasks_used INTEGER DEFAULT 0,
  tasks_limit INTEGER NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  tokens_limit INTEGER NOT NULL,
  emails_sent INTEGER DEFAULT 0,
  emails_limit INTEGER NOT NULL,
  UNIQUE(client_id, period_start)
);

-- OAuth/API integrations per client
CREATE TABLE integrations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('GMAIL', 'GOOGLE_BUSINESS', 'WHATSAPP', 'TELEGRAM', 'SMTP')),
  credentials JSONB NOT NULL DEFAULT '{}',
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'REVOKED', 'ERROR')),
  last_synced_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  UNIQUE(client_id, type)
);

-- Indexes for performance
CREATE INDEX idx_agent_tasks_client_status ON agent_tasks(client_id, status);
CREATE INDEX idx_agent_tasks_scheduled ON agent_tasks(status, scheduled_for) WHERE status = 'PENDING';
CREATE INDEX idx_agent_tasks_processing ON agent_tasks(status, updated_at) WHERE status = 'PROCESSING';
CREATE INDEX idx_agent_logs_client ON agent_logs(client_id, created_at);
CREATE INDEX idx_agent_quotas_client_period ON agent_quotas(client_id, period_start);
CREATE INDEX idx_integrations_client ON integrations(client_id);

-- RLS policies
ALTER TABLE agent_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
