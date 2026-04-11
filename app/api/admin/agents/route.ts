import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/admin/agents — Global agent monitoring for admin dashboard
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      { data: allTasks },
      { data: todayTasks },
      { data: recentTasks },
      { data: monthLogs },
      { data: workerTasks },
    ] = await Promise.all([
      // All-time task stats
      supabase
        .from("agent_tasks")
        .select("id, status, agent_type")
        .limit(5000),
      // Today's tasks
      supabase
        .from("agent_tasks")
        .select("id, status, agent_type")
        .gte("created_at", todayStart),
      // Recent 30 tasks with details
      supabase
        .from("agent_tasks")
        .select("id, client_id, agent_type, task_type, status, priority, error, created_at, completed_at, started_at, retry_count")
        .order("created_at", { ascending: false })
        .limit(30),
      // This month's logs for cost
      supabase
        .from("agent_logs")
        .select("agent_type, tokens_used, cost_cents, duration_ms, action, created_at")
        .gte("created_at", monthStart),
      // Tasks in the last week for trend
      supabase
        .from("agent_tasks")
        .select("status, created_at")
        .gte("created_at", weekAgo),
    ]);

    // ─── KPIs ───────────────────────────────────────────────────
    const tasks = allTasks || [];
    const today = todayTasks || [];
    const logs = monthLogs || [];
    const weekTasks = workerTasks || [];

    const totalTasks = tasks.length;
    const completed = tasks.filter(t => t.status === "COMPLETED").length;
    const failed = tasks.filter(t => t.status === "FAILED").length;
    const pending = tasks.filter(t => t.status === "PENDING" || t.status === "PROCESSING").length;
    const successRate = totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;

    const todayTotal = today.length;
    const todayCompleted = today.filter(t => t.status === "COMPLETED").length;
    const todayFailed = today.filter(t => t.status === "FAILED").length;

    const totalTokens = logs.reduce((s, l) => s + (l.tokens_used || 0), 0);
    const totalCost = logs.reduce((s, l) => s + (l.cost_cents || 0), 0);
    const avgDuration = logs.length > 0
      ? Math.round(logs.reduce((s, l) => s + (l.duration_ms || 0), 0) / logs.length)
      : 0;

    // ─── By agent type ──────────────────────────────────────────
    const byAgent: Record<string, { total: number; completed: number; failed: number }> = {};
    for (const t of tasks) {
      const at = t.agent_type || "UNKNOWN";
      if (!byAgent[at]) byAgent[at] = { total: 0, completed: 0, failed: 0 };
      byAgent[at].total++;
      if (t.status === "COMPLETED") byAgent[at].completed++;
      if (t.status === "FAILED") byAgent[at].failed++;
    }

    // ─── Daily trend (last 7 days) ──────────────────────────────
    const dailyTrend: { date: string; total: number; completed: number; failed: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split("T")[0];
      const dayTasks = weekTasks.filter(t => t.created_at?.startsWith(dateStr));
      dailyTrend.push({
        date: dateStr,
        total: dayTasks.length,
        completed: dayTasks.filter(t => t.status === "COMPLETED").length,
        failed: dayTasks.filter(t => t.status === "FAILED").length,
      });
    }

    // ─── Top task types ─────────────────────────────────────────
    const taskTypeCounts: Record<string, number> = {};
    for (const l of logs) {
      const a = l.action || "unknown";
      taskTypeCounts[a] = (taskTypeCounts[a] || 0) + 1;
    }
    const topTaskTypes = Object.entries(taskTypeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([type, count]) => ({ type, count }));

    // ─── Format recent tasks ────────────────────────────────────
    const formatted = (recentTasks || []).map((t: any) => ({
      id: t.id,
      clientId: t.client_id,
      agentType: t.agent_type,
      taskType: t.task_type,
      status: t.status,
      error: t.error,
      createdAt: t.created_at,
      completedAt: t.completed_at,
      startedAt: t.started_at,
      retryCount: t.retry_count,
    }));

    return NextResponse.json({
      kpis: {
        totalTasks,
        completed,
        failed,
        pending,
        successRate,
        todayTotal,
        todayCompleted,
        todayFailed,
        totalTokens,
        totalCostCents: totalCost,
        avgDurationMs: avgDuration,
      },
      byAgent,
      dailyTrend,
      topTaskTypes,
      recentTasks: formatted,
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    console.error("Admin agents error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
