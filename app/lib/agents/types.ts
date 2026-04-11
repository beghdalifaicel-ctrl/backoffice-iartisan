// Agent types and interfaces

export type AgentType = 'ADMIN' | 'MARKETING' | 'COMMERCIAL';
export type TaskStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type PlanType = 'ESSENTIEL' | 'CROISSANCE' | 'PILOTE_AUTO';

// Which agents each plan can access
export const PLAN_AGENTS: Record<PlanType, AgentType[]> = {
  ESSENTIEL: ['ADMIN'],
  CROISSANCE: ['ADMIN', 'MARKETING'],
  PILOTE_AUTO: ['ADMIN', 'MARKETING', 'COMMERCIAL'],
};

// Quotas per plan per month
export const PLAN_QUOTAS: Record<PlanType, { tasks: number; tokens: number; emails: number; messages: number }> = {
  ESSENTIEL: { tasks: 500, tokens: 500_000, emails: 100, messages: 100 },
  CROISSANCE: { tasks: 2000, tokens: 2_000_000, emails: 500, messages: 500 },
  PILOTE_AUTO: { tasks: 5000, tokens: 5_000_000, emails: 2000, messages: -1 }, // -1 = unlimited
};

// Default assistant names per agent type
export const DEFAULT_AGENT_NAMES: Record<AgentType, string> = {
  ADMIN: 'Alice',
  MARKETING: 'Marc',
  COMMERCIAL: 'Léa',
};

// Agent descriptions for onboarding
export const AGENT_DESCRIPTIONS: Record<AgentType, string> = {
  ADMIN: 'Gère vos emails, devis, factures et relances clients',
  MARKETING: 'Optimise votre fiche Google, répond aux avis, gère votre SEO et réseaux sociaux',
  COMMERCIAL: 'Prospecte, qualifie les leads, relance les impayés et vous inscrit sur les annuaires',
};

// Task types per agent
export const AGENT_CAPABILITIES: Record<AgentType, string[]> = {
  ADMIN: [
    'email.read',
    'email.summarize',
    'email.reply',
    'quote.generate',
    'invoice.generate',
    'invoice.followup',
    'client.followup',
    'report.weekly',
  ],
  MARKETING: [
    'gbp.optimize',
    'gbp.post',
    'review.respond',
    'seo.audit',
    'site.update',
    'social.post',
  ],
  COMMERCIAL: [
    'lead.scrape',
    'lead.qualify',
    'lead.respond',
    'prospect.email',
    'directory.enroll',
    'invoice.collect',
  ],
};

export interface AgentTask {
  id: string;
  clientId: string;
  agentType: AgentType;
  taskType: string;
  status: TaskStatus;
  priority: number;
  payload: Record<string, any>;
  result?: Record<string, any>;
  error?: string;
  retryCount: number;
  maxRetries: number;
  scheduledFor: Date;
  createdAt: Date;
}

export interface AgentConfig {
  id: string;
  clientId: string;
  agentType: AgentType;
  enabled: boolean;
  settings: Record<string, any>;
}

export interface AgentLog {
  clientId: string;
  agentType: AgentType;
  taskId?: string;
  action: string;
  tokensUsed: number;
  modelUsed: string;
  durationMs: number;
  costCents: number;
  metadata?: Record<string, any>;
}

export interface ToolCall {
  id: string;
  function: { name: string; arguments: string };
}

export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  tokensUsed: { prompt: number; completion: number; total: number };
  model: string;
  durationMs: number;
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (params: Record<string, any>, context: AgentContext) => Promise<any>;
}

export interface AgentContext {
  clientId: string;
  agentType: AgentType;
  plan: PlanType;
  integrations: Record<string, any>;
  config: AgentConfig;
}
