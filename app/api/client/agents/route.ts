import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireClient } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const session = await requireClient();
    const clientId = session.clientId!;

    // ─── Prisma: leads, sources, client ────────────────────────────────
    const [recentLeads, leadsBySource, totalLeads, client] = await Promise.all([
      prisma.lead.findMany({
        where: { clientId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          type: true,
          source: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.lead.groupBy({
        by: ["source"],
        where: { clientId },
        _count: true,
      }),
      prisma.lead.count({ where: { clientId } }),
      prisma.client.findUnique({
        where: { id: clientId },
        select: {
          plan: true,
          googleRating: true,
          googleReviewCount: true,
          _count: { select: { avis: true } },
        },
      }),
    ]);

    const sourceCounts: Record<string, number> = {};
    leadsBySource.forEach((s) => {
      sourceCounts[s.source] = s._count;
    });

    // ─── Supabase: agent tasks & logs ──────────────────────────────────
    let agentTaskStats = { total: 0, completed: 0, failed: 0, pending: 0 };
    let agentUsage = { tokensUsed: 0, totalCost: 0, tasksThisMonth: 0 };
    let recentTasks: any[] = [];

    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Tasks stats globales
      const { data: tasks } = await supabase
        .from("agent_tasks")
        .select("id, status, agent_type, task_type, created_at, completed_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (tasks && tasks.length > 0) {
        agentTaskStats.total = tasks.length;
        agentTaskStats.completed = tasks.filter((t: any) => t.status === "COMPLETED").length;
        agentTaskStats.failed = tasks.filter((t: any) => t.status === "FAILED").length;
        agentTaskStats.pending = tasks.filter((t: any) => t.status === "PENDING" || t.status === "PROCESSING").length;

        // 10 dernières tâches pour l'activité
        recentTasks = tasks.slice(0, 10).map((t: any) => ({
          id: t.id,
          agentType: t.agent_type,
          taskType: t.task_type,
          status: t.status,
          createdAt: t.created_at,
          completedAt: t.completed_at,
        }));
      }

      // Logs d'usage ce mois
      const { data: logs } = await supabase
        .from("agent_logs")
        .select("tokens_used, cost_cents")
        .eq("client_id", clientId)
        .gte("created_at", startOfMonth);

      if (logs && logs.length > 0) {
        agentUsage.tasksThisMonth = logs.length;
        agentUsage.tokensUsed = logs.reduce((sum: number, l: any) => sum + (l.tokens_used || 0), 0);
        agentUsage.totalCost = logs.reduce((sum: number, l: any) => sum + (l.cost_cents || 0), 0);
      }

      // Quota
      const { data: quota } = await supabase
        .from("agent_quotas")
        .select("tasks_used, tasks_limit, tokens_used, tokens_limit")
        .eq("client_id", clientId)
        .order("period_start", { ascending: false })
        .limit(1)
        .single();

      if (quota) {
        agentUsage = {
          ...agentUsage,
          ...quota,
        };
      }
    } catch (e) {
      // Tables Supabase pas encore peuplées, pas grave
    }

    // ─── Agents actifs selon le plan (aligné sur PLAN_AGENTS de types.ts) ──
    // ESSENTIEL = ADMIN seul | CROISSANCE = ADMIN + MARKETING | PILOTE_AUTO = tous
    const agentsByPlan: Record<string, { name: string; type: string; desc: string }[]> = {
      ESSENTIEL: [
        { name: "Alice", type: "ADMIN", desc: "Gestion emails, devis, factures et relances" },
      ],
      CROISSANCE: [
        { name: "Alice", type: "ADMIN", desc: "Gestion emails, devis, factures et relances" },
        { name: "Marc", type: "MARKETING", desc: "Google Business, avis, SEO et réseaux sociaux" },
      ],
      PILOTE_AUTO: [
        { name: "Alice", type: "ADMIN", desc: "Gestion emails, devis, factures et relances" },
        { name: "Marc", type: "MARKETING", desc: "Google Business, avis, SEO et réseaux sociaux" },
        { name: "Léa", type: "COMMERCIAL", desc: "Prospection, scraping et emails commerciaux" },
      ],
    };

    const plan = client?.plan || "ESSENTIEL";
    const activeAgents = agentsByPlan[plan] || agentsByPlan.ESSENTIEL;

    return NextResponse.json({
      agents: activeAgents.map((a) => ({
        ...a,
        active: true,
      })),
      activity: recentLeads,
      recentTasks,
      agentTaskStats,
      agentUsage,
      stats: {
        totalLeads,
        bySource: sourceCounts,
        googleRating: client?.googleRating,
        googleReviewCount: client?.googleReviewCount,
        avisCount: client?._count?.avis || 0,
      },
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    console.error("Client agents error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
