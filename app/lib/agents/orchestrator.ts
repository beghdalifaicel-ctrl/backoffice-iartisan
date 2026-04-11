import { AgentType, AgentTask, AgentContext, PlanType, PLAN_AGENTS, PLAN_QUOTAS, AGENT_CAPABILITIES } from './types';
import { callLLM, estimateCostCents } from './llm';
import { getAgentTools } from './tools/registry';

// SQL queries use raw Supabase client for agent tables (not in Prisma schema)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export class AgentOrchestrator {
  // Validate that a client can use a specific agent/task
  async validateAccess(
    clientId: string,
    agentType: AgentType,
    taskType: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    // 1. Get client plan
    const { data: client } = await supabase
      .from('clients')
      .select('plan, status')
      .eq('id', clientId)
      .single();

    if (!client) return { allowed: false, reason: 'Client not found' };
    if (!['ACTIVE', 'TRIAL'].includes(client.status)) {
      return { allowed: false, reason: `Client status is ${client.status}` };
    }

    const plan = client.plan as PlanType;

    // 2. Check plan includes this agent
    if (!PLAN_AGENTS[plan].includes(agentType)) {
      return { allowed: false, reason: `Plan ${plan} does not include agent ${agentType}` };
    }

    // 3. Check capability exists for this agent
    if (!AGENT_CAPABILITIES[agentType].includes(taskType)) {
      return { allowed: false, reason: `Agent ${agentType} cannot perform ${taskType}` };
    }

    // 4. Check quotas
    const quotaCheck = await this.checkQuota(clientId, plan);
    if (!quotaCheck.allowed) {
      return { allowed: false, reason: quotaCheck.reason };
    }

    return { allowed: true };
  }

  // Check if client has remaining quota
  async checkQuota(clientId: string, plan: PlanType): Promise<{ allowed: boolean; reason?: string }> {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

    const { data: quota } = await supabase
      .from('agent_quotas')
      .select('*')
      .eq('client_id', clientId)
      .eq('period_start', periodStart)
      .single();

    if (!quota) {
      // Create quota record for this period
      const limits = PLAN_QUOTAS[plan];
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      await supabase.from('agent_quotas').insert({
        client_id: clientId,
        period_start: periodStart,
        period_end: periodEnd,
        tasks_limit: limits.tasks,
        tokens_limit: limits.tokens,
        emails_limit: limits.emails,
      });
      return { allowed: true };
    }

    if (quota.tasks_used >= quota.tasks_limit) {
      return { allowed: false, reason: 'Monthly task limit reached' };
    }
    if (quota.tokens_used >= quota.tokens_limit) {
      return { allowed: false, reason: 'Monthly token limit reached' };
    }

    return { allowed: true };
  }

  // Submit a new task
  async submitTask(
    clientId: string,
    agentType: AgentType,
    taskType: string,
    payload: Record<string, any> = {},
    priority: number = 0,
    scheduledFor?: Date
  ): Promise<{ taskId: string } | { error: string }> {
    // Validate access
    const access = await this.validateAccess(clientId, agentType, taskType);
    if (!access.allowed) {
      return { error: access.reason || 'Access denied' };
    }

    // Insert task
    const { data: task, error } = await supabase
      .from('agent_tasks')
      .insert({
        client_id: clientId,
        agent_type: agentType,
        task_type: taskType,
        payload,
        priority,
        scheduled_for: scheduledFor?.toISOString() || new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error || !task) {
      return { error: error?.message || 'Failed to create task' };
    }

    return { taskId: task.id };
  }

  // Build agent context from DB
  private async buildContext(task: any): Promise<AgentContext> {
    const { data: client } = await supabase
      .from('clients')
      .select('plan')
      .eq('id', task.client_id)
      .single();

    const { data: config } = await supabase
      .from('agent_configs')
      .select('*')
      .eq('client_id', task.client_id)
      .eq('agent_type', task.agent_type)
      .single();

    const { data: integrations } = await supabase
      .from('integrations')
      .select('*')
      .eq('client_id', task.client_id)
      .eq('status', 'ACTIVE');

    return {
      clientId: task.client_id,
      agentType: task.agent_type as AgentType,
      plan: client?.plan as PlanType,
      integrations: Object.fromEntries((integrations || []).map((i: any) => [i.type, i])),
      config: config || {
        id: '',
        clientId: task.client_id,
        agentType: task.agent_type,
        enabled: true,
        settings: {},
      },
    };
  }

  // Process a task (called by worker)
  // Strategy: Direct tool execution when possible, LLM-assisted when needed
  async processTask(taskId: string): Promise<void> {
    const startTime = Date.now();

    // 1. Claim the task (atomic — prevents double processing)
    const { data: task, error } = await supabase
      .from('agent_tasks')
      .update({ status: 'PROCESSING', started_at: new Date().toISOString() })
      .eq('id', taskId)
      .eq('status', 'PENDING')
      .select('*')
      .single();

    if (!task || error) return; // Already claimed by another worker

    try {
      // 2. Build context
      const context = await this.buildContext(task);

      // 3. Get tools for this task type
      const tools = getAgentTools(task.agent_type as AgentType, task.task_type);

      let result: any;
      let tokensUsed = 0;
      let modelUsed = 'direct';

      if (tools.length > 0) {
        // ─── STRATEGY A: Direct tool execution ───────────────────────
        // The user already selected the tool and provided the payload.
        // Execute the first matching tool directly — faster, cheaper, more reliable.
        const tool = tools[0];

        try {
          result = await tool.execute(task.payload || {}, context);
        } catch (toolErr: any) {
          // If direct execution fails, fall back to LLM-assisted mode
          console.warn(`[Agent] Direct tool exec failed for ${task.task_type}, falling back to LLM:`, toolErr.message);
          const llmResult = await this.processWithLLM(task, tools, context);
          result = llmResult.result;
          tokensUsed = llmResult.tokensUsed;
          modelUsed = llmResult.model;
        }
      } else {
        // ─── STRATEGY B: LLM-only (no registered tool) ──────────────
        const llmResult = await this.processWithLLM(task, tools, context);
        result = llmResult.result;
        tokensUsed = llmResult.tokensUsed;
        modelUsed = llmResult.model;
      }

      const durationMs = Date.now() - startTime;

      // 4. Update task as completed
      await supabase
        .from('agent_tasks')
        .update({
          status: 'COMPLETED',
          result: typeof result === 'string' ? { content: result } : result,
          completed_at: new Date().toISOString(),
        })
        .eq('id', taskId);

      // 5. Log execution
      const costCents = tokensUsed > 0 ? estimateCostCents(tokensUsed, task.task_type) : 0;
      await this.logExecution({
        clientId: task.client_id,
        agentType: task.agent_type as AgentType,
        taskId,
        action: task.task_type,
        tokensUsed,
        modelUsed,
        durationMs,
        costCents,
      });

      // 6. Update quotas
      if (tokensUsed > 0) {
        await this.incrementQuota(task.client_id, tokensUsed);
      }
    } catch (err: any) {
      // Handle failure with retry
      const newRetryCount = (task.retry_count || 0) + 1;
      const shouldRetry = newRetryCount < (task.max_retries || 3);

      await supabase
        .from('agent_tasks')
        .update({
          status: shouldRetry ? 'PENDING' : 'FAILED',
          error: err.message,
          retry_count: newRetryCount,
          scheduled_for: shouldRetry
            ? new Date(Date.now() + Math.pow(2, newRetryCount) * 60000).toISOString()
            : undefined,
        })
        .eq('id', taskId);

      await this.logExecution({
        clientId: task.client_id,
        agentType: task.agent_type as AgentType,
        taskId,
        action: `${task.task_type}.error`,
        tokensUsed: 0,
        modelUsed: '',
        durationMs: Date.now() - startTime,
        costCents: 0,
        metadata: { error: err.message, retryCount: newRetryCount },
      });
    }
  }

  // LLM-assisted processing with tool execution loop
  private async processWithLLM(
    task: any,
    tools: any[],
    context: AgentContext
  ): Promise<{ result: any; tokensUsed: number; model: string }> {
    const systemPrompt = this.buildSystemPrompt(context, task.task_type);
    let totalTokens = 0;
    let model = '';

    const toolDefs = tools.map(t => ({
      type: 'function' as const,
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));

    // Initial LLM call
    let llmResponse = await callLLM({
      taskType: task.task_type,
      systemPrompt,
      userPrompt: JSON.stringify(task.payload),
      tools: toolDefs.length > 0 ? toolDefs : undefined,
      responseFormat: 'text',
    });

    totalTokens += llmResponse.tokensUsed.total;
    model = llmResponse.model;

    // Tool execution loop (max 5 rounds to prevent infinite loops)
    let rounds = 0;
    while (llmResponse.toolCalls && llmResponse.toolCalls.length > 0 && rounds < 5) {
      rounds++;
      const toolResults: any[] = [];

      for (const tc of llmResponse.toolCalls) {
        const tool = tools.find(t => t.name === tc.function.name);
        if (!tool) {
          toolResults.push({ id: tc.id, error: `Tool ${tc.function.name} not found` });
          continue;
        }

        try {
          const params = JSON.parse(tc.function.arguments);
          const execResult = await tool.execute(params, context);
          toolResults.push({ id: tc.id, result: JSON.stringify(execResult).slice(0, 4000) });
        } catch (execErr: any) {
          toolResults.push({ id: tc.id, error: execErr.message });
        }
      }

      // Send tool results back to LLM for final synthesis
      const toolResultsPrompt = toolResults.map(r =>
        r.error
          ? `Tool ${r.id}: ERROR — ${r.error}`
          : `Tool ${r.id}: ${r.result}`
      ).join('\n\n');

      llmResponse = await callLLM({
        taskType: task.task_type,
        systemPrompt,
        userPrompt: `Résultats des outils exécutés:\n\n${toolResultsPrompt}\n\nRésume le résultat pour le client.`,
        responseFormat: 'text',
      });

      totalTokens += llmResponse.tokensUsed.total;
    }

    return {
      result: { content: llmResponse.content, toolsExecuted: rounds > 0 },
      tokensUsed: totalTokens,
      model,
    };
  }

  private buildSystemPrompt(context: AgentContext, taskType: string): string {
    const basePrompt = `Tu es un agent IA spécialisé pour les artisans du bâtiment en France.
Tu travailles pour le compte de l'entreprise de l'artisan. Sois professionnel, concis et efficace.
Réponds toujours en français. Adapte ton ton au métier de l'artisan.`;

    const agentPrompts: Record<AgentType, string> = {
      ADMIN: `${basePrompt}
Tu es l'Agent Admin. Tu gères l'administratif : emails, devis, factures, relances clients.
Tu connais les termes techniques du bâtiment et tu sais rédiger des devis professionnels.`,
      MARKETING: `${basePrompt}
Tu es l'Agent Marketing. Tu gères la présence en ligne : fiche Google, avis, SEO local, réseaux sociaux.
Tu sais comment optimiser la visibilité locale d'un artisan.`,
      COMMERCIAL: `${basePrompt}
Tu es l'Agent Commercial. Tu prospectes, qualifies les leads, et relances les impayés.
Tu es persuasif mais professionnel, et tu connais le secteur du BTP.`,
    };

    return agentPrompts[context.agentType] || basePrompt;
  }

  private async logExecution(log: {
    clientId: string;
    agentType: AgentType;
    taskId: string;
    action: string;
    tokensUsed: number;
    modelUsed: string;
    durationMs: number;
    costCents: number;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await supabase.from('agent_logs').insert({
      client_id: log.clientId,
      agent_type: log.agentType,
      task_id: log.taskId,
      action: log.action,
      tokens_used: log.tokensUsed,
      model_used: log.modelUsed,
      duration_ms: log.durationMs,
      cost_cents: log.costCents,
      metadata: log.metadata || {},
    });
  }

  private async incrementQuota(clientId: string, tokensUsed: number): Promise<void> {
    const periodStart = new Date();
    const periodKey = `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, '0')}-01`;

    await supabase.rpc('increment_quota', {
      p_client_id: clientId,
      p_period_start: periodKey,
      p_tasks: 1,
      p_tokens: tokensUsed,
    });
  }
}

export const orchestrator = new AgentOrchestrator();
