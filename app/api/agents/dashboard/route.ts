import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSession } from '@/app/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clientId = request.nextUrl.searchParams.get('clientId');
  if (!clientId) {
    return NextResponse.json({ error: 'clientId required' }, { status: 400 });
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  try {
    // Parallel queries for agent configs, tasks, integrations, and logs
    const [
      { data: configs, error: configsErr },
      { data: todayTasks, error: todayTasksErr },
      { data: recentTasks, error: recentTasksErr },
      { data: quota, error: quotaErr },
      { data: integrations, error: integrationsErr },
      { data: logs, error: logsErr },
    ] = await Promise.all([
      supabase.from('agent_configs').select('*').eq('client_id', clientId),
      supabase.from('agent_tasks').select('id, status').eq('client_id', clientId).gte('created_at', todayStart),
      supabase.from('agent_tasks').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(20),
      supabase.from('agent_quotas').select('*').eq('client_id', clientId).gte('period_start', monthStart).order('period_start', { ascending: false }).limit(1),
      supabase.from('integrations').select('type, status, last_synced_at').eq('client_id', clientId),
      supabase.from('agent_logs').select('tokens_used, cost_cents').eq('client_id', clientId).gte('created_at', monthStart),
    ]);

    if (configsErr) console.error('Configs error:', configsErr);
    if (todayTasksErr) console.error('Today tasks error:', todayTasksErr);
    if (recentTasksErr) console.error('Recent tasks error:', recentTasksErr);
    if (quotaErr) console.error('Quota error:', quotaErr);
    if (integrationsErr) console.error('Integrations error:', integrationsErr);
    if (logsErr) console.error('Logs error:', logsErr);

    // Compute KPIs
    const totalToday = todayTasks?.length || 0;
    const completedToday = todayTasks?.filter(t => t.status === 'COMPLETED').length || 0;
    const successRate = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 100;
    const totalTokensMonth = logs?.reduce((sum, l) => sum + (l.tokens_used || 0), 0) || 0;
    const totalCostMonth = logs?.reduce((sum, l) => sum + (l.cost_cents || 0), 0) || 0;
    const activeIntegrations = integrations?.filter(i => i.status === 'ACTIVE').length || 0;

    return NextResponse.json({
      kpis: {
        tasksToday: totalToday,
        successRate,
        tokensMonth: totalTokensMonth,
        costMonth: totalCostMonth,
        activeIntegrations,
      },
      agents: configs || [],
      recentTasks: recentTasks || [],
      quota: quota || null,
      integrations: integrations || [],
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
