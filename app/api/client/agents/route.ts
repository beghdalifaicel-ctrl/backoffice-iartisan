import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireClient } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await requireClient();
    const clientId = session.clientId!;

    // Récupérer les leads récents (proxy pour l'activité des agents)
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

    // Déterminer les agents actifs selon le plan
    const agentsByPlan: Record<string, string[]> = {
      ESSENTIEL: ["Agent Leads"],
      CROISSANCE: ["Agent Leads", "Agent Google Ads", "Agent Avis"],
      PILOTE_AUTO: ["Agent Leads", "Agent Google Ads", "Agent Avis", "Agent WhatsApp", "Agent Site Vitrine"],
    };

    const plan = client?.plan || "ESSENTIEL";
    const activeAgents = agentsByPlan[plan] || agentsByPlan.ESSENTIEL;

    return NextResponse.json({
      agents: activeAgents.map((name) => ({
        name,
        active: true,
      })),
      activity: recentLeads,
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
