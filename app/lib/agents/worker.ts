import { createClient } from '@supabase/supabase-js';
import { orchestrator } from './orchestrator';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const POLL_INTERVAL_MS = 5000; // 5 seconds
const BATCH_SIZE = 10;

export async function processTaskQueue(): Promise<number> {
  // Fetch pending tasks, ordered by priority and scheduled time
  const { data: tasks, error } = await supabase
    .from('agent_tasks')
    .select('id')
    .eq('status', 'PENDING')
    .lte('scheduled_for', new Date().toISOString())
    .order('priority', { ascending: false })
    .order('scheduled_for', { ascending: true })
    .limit(BATCH_SIZE);

  if (error || !tasks?.length) return 0;

  // Process tasks concurrently (with limit)
  const results = await Promise.allSettled(tasks.map(task => orchestrator.processTask(task.id)));

  const processed = results.filter(r => r.status === 'fulfilled').length;
  return processed;
}

// Detect and recover stale tasks (stuck in PROCESSING for > 10 minutes)
export async function recoverStaleTasks(): Promise<number> {
  const staleThreshold = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data: staleTasks } = await supabase
    .from('agent_tasks')
    .update({
      status: 'PENDING',
      error: 'Task timed out — retrying',
    })
    .eq('status', 'PROCESSING')
    .lt('updated_at', staleThreshold)
    .select('id');

  return staleTasks?.length || 0;
}

// Start the worker loop (for standalone deployment)
export async function startWorker(): Promise<void> {
  console.log('[AgentWorker] Starting task processor...');

  let recoveryCounter = 0;

  while (true) {
    try {
      const processed = await processTaskQueue();
      if (processed > 0) {
        console.log(`[AgentWorker] Processed ${processed} tasks`);
      }

      // Run stale task recovery every 12 cycles (1 minute)
      recoveryCounter++;
      if (recoveryCounter >= 12) {
        const recovered = await recoverStaleTasks();
        if (recovered > 0) {
          console.log(`[AgentWorker] Recovered ${recovered} stale tasks`);
        }
        recoveryCounter = 0;
      }
    } catch (err) {
      console.error('[AgentWorker] Error:', err);
    }

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}
