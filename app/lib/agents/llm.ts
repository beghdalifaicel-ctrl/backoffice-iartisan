import { LLMResponse } from './types';

// LLM Provider abstraction — Mistral primary for cost control
// Mistral Small: ~0.1€/1M input, ~0.3€/1M output (classification, extraction)
// Mistral Large: ~2€/1M input, ~6€/1M output (generation, complex reasoning)

type ModelTier = 'fast' | 'balanced' | 'powerful';

const MODEL_MAP: Record<ModelTier, { provider: string; model: string; costPer1kTokens: number }> = {
  fast: {
    provider: 'mistral',
    model: 'mistral-small-latest',
    costPer1kTokens: 0.0002, // ~0.2€/1M tokens avg
  },
  balanced: {
    provider: 'mistral',
    model: 'mistral-medium-latest',
    costPer1kTokens: 0.0027,
  },
  powerful: {
    provider: 'mistral',
    model: 'mistral-large-latest',
    costPer1kTokens: 0.004, // ~4€/1M tokens avg
  },
};

// Task-to-model routing: use the cheapest model that can handle the task
const TASK_MODEL_MAP: Record<string, ModelTier> = {
  // Fast tier — classification, extraction, simple responses
  'email.summarize': 'fast',
  'lead.qualify': 'fast',
  'review.respond': 'fast',
  'client.followup': 'fast',
  'invoice.followup': 'fast',

  // Balanced — moderate generation
  'email.reply': 'balanced',
  'gbp.post': 'balanced',
  'social.post': 'balanced',
  'lead.respond': 'balanced',

  // Powerful — complex generation, analysis
  'quote.generate': 'powerful',
  'invoice.generate': 'powerful',
  'seo.audit': 'powerful',
  'prospect.email': 'powerful',
  'report.weekly': 'powerful',
  'site.update': 'powerful',
};

interface LLMCallOptions {
  taskType: string;
  systemPrompt: string;
  userPrompt: string;
  tools?: any[];
  maxTokens?: number;
  temperature?: number;
  responseFormat?: 'text' | 'json';
}

export async function callLLM(options: LLMCallOptions): Promise<LLMResponse> {
  const tier = TASK_MODEL_MAP[options.taskType] || 'balanced';
  const modelConfig = MODEL_MAP[tier];

  const startTime = Date.now();

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error('MISTRAL_API_KEY not configured');

  const body: any = {
    model: modelConfig.model,
    messages: [
      { role: 'system', content: options.systemPrompt },
      { role: 'user', content: options.userPrompt },
    ],
    max_tokens: options.maxTokens || 2048,
    temperature: options.temperature ?? 0.3,
  };

  if (options.tools?.length) {
    body.tools = options.tools;
    body.tool_choice = 'auto';
  }

  if (options.responseFormat === 'json') {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LLM API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  const durationMs = Date.now() - startTime;

  const tokensUsed = {
    prompt: data.usage?.prompt_tokens || 0,
    completion: data.usage?.completion_tokens || 0,
    total: data.usage?.total_tokens || 0,
  };

  return {
    content: data.choices[0]?.message?.content || '',
    tokensUsed,
    model: modelConfig.model,
    durationMs,
  };
}

export function estimateCostCents(tokensUsed: number, taskType: string): number {
  const tier = TASK_MODEL_MAP[taskType] || 'balanced';
  const modelConfig = MODEL_MAP[tier];
  return Math.ceil((tokensUsed / 1000) * modelConfig.costPer1kTokens * 100); // in cents
}
