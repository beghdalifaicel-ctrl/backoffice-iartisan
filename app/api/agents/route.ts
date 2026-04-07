import { NextRequest, NextResponse } from 'next/server';
import { orchestrator } from '@/app/lib/agents/orchestrator';
import { AgentType } from '@/app/lib/agents/types';
import { verifyAuth } from '@/app/lib/auth';

// POST /api/agents — Submit a new agent task
export async function POST(request: NextRequest) {
  // Verify admin auth
  const authResult = await verifyAuth(request);
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { clientId, agentType, taskType, payload, priority, scheduledFor } = body;

  if (!clientId || !agentType || !taskType) {
    return NextResponse.json(
      { error: 'clientId, agentType, and taskType are required' },
      { status: 400 }
    );
  }

  const result = await orchestrator.submitTask(
    clientId,
    agentType as AgentType,
    taskType,
    payload || {},
    priority || 0,
    scheduledFor ? new Date(scheduledFor) : undefined
  );

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }

  return NextResponse.json({ taskId: result.taskId, status: 'PENDING' });
}
