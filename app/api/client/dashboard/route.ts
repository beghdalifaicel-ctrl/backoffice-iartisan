import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireClient } from "@/lib/auth";

export async function GET() {
  try {
    const session = await requireClient();
    const clientId = session.clientId!;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [client, leadsThisMonth, leadsLastMonth, leadsTotal, leadsByStatus, invoices] =
      await Promise.all([
        prisma.client.findUnique({
          where: { id: clientId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            company: true,
            plan: true,
            status: true,
            email: true,
            phone: true,
            metier: true,
            ville: true,
            googleRating: true,
            googleReviewCount: true,
            siteUrl: true,
            trialEndsAt: true,
          },
        }),
        prisma.lead.count({
          where: { clientId, createdAt: { gte: startOfMonth } },
        }),
        prisma.lead.count({
          where: {
            clientId,
            createdAt: { gte: startOfLastMonth, lt: startOfMonth },
          },
        }),
        prisma.lead.count({ where: { clientId } }),
        prisma.lead.groupBy({
          by: ["status"],
          where: { clientId },
          _count: true,
        }),
        prisma.invoice.findMany({
          where: { clientId },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
      ]);

    if (!client) {
      return NextResponse.json({ error: "Client non trouvé" }, { status: 404 });
    }

    const statusCounts: Record<string, number> = {};
    leadsByStatus.forEach((s) => {
      statusCounts[s.status] = s._count;
    });

    const conversionRate =
      leadsTotal > 0
        ? Math.round(((statusCounts.WON || 0) / leadsTotal) * 100)
        : 0;

    return NextResponse.json({
      client,
      leads: {
        thisMonth: leadsThisMonth,
        lastMonth: leadsLastMonth,
        total: leadsTotal,
        byStatus: statusCounts,
        conversionRate,
      },
      invoices,
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    console.error("Client dashboard error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
