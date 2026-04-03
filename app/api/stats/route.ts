import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/stats — KPIs dashboard en temps réel
export async function GET() {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Clients par statut
    const [totalClients, activeClients, trialClients, churnedClients, pastDueClients] = await Promise.all([
      prisma.client.count(),
      prisma.client.count({ where: { status: "ACTIVE" } }),
      prisma.client.count({ where: { status: "TRIAL" } }),
      prisma.client.count({ where: { status: "CHURNED" } }),
      prisma.client.count({ where: { status: "PAST_DUE" } }),
    ]);

    // MRR (Monthly Recurring Revenue)
    const activeWithPlans = await prisma.client.findMany({
      where: { status: { in: ["ACTIVE", "TRIAL"] } },
      select: { plan: true },
    });

    const planPrices: Record<string, number> = { ESSENTIEL: 49, CROISSANCE: 99, PILOTE_AUTO: 179 };
    const mrr = activeWithPlans.reduce((sum: number, c: { plan: string }) => sum + (planPrices[c.plan] || 0), 0);

    // Répartition par offre
    const planCounts = {
      ESSENTIEL: activeWithPlans.filter((c: { plan: string }) => c.plan === "ESSENTIEL").length,
      CROISSANCE: activeWithPlans.filter((c: { plan: string }) => c.plan === "CROISSANCE").length,
      PILOTE_AUTO: activeWithPlans.filter((c: { plan: string }) => c.plan === "PILOTE_AUTO").length,
    };

    // Leads ce mois
    const [leadsThisMonth, leadsLastMonth, totalSiteLeads] = await Promise.all([
      prisma.siteLead.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.siteLead.count({ where: { createdAt: { gte: startOfLastMonth, lt: startOfMonth } } }),
      prisma.siteLead.count(),
    ]);

    // Leads par statut
    const siteLeadsByStatus = {
      new: await prisma.siteLead.count({ where: { status: "NEW" } }),
      contacted: await prisma.siteLead.count({ where: { status: "CONTACTED" } }),
      demoBooked: await prisma.siteLead.count({ where: { status: "DEMO_BOOKED" } }),
      converted: await prisma.siteLead.count({ where: { status: "CONVERTED" } }),
      lost: await prisma.siteLead.count({ where: { status: "LOST" } }),
    };

    // Revenus ce mois
    const revenueThisMonth = await prisma.invoice.aggregate({
      where: { status: "PAID", paidAt: { gte: startOfMonth } },
      _sum: { amount: true },
    });

    // Impayés
    const unpaidInvoices = await prisma.invoice.count({ where: { status: { in: ["PENDING", "PAST_DUE"] } } });
    const unpaidAmount = await prisma.invoice.aggregate({
      where: { status: { in: ["PENDING", "PAST_DUE"] } },
      _sum: { amount: true },
    });

    return NextResponse.json({
      clients: {
        total: totalClients,
        active: activeClients,
        trial: trialClients,
        churned: churnedClients,
        pastDue: pastDueClients,
      },
      revenue: {
        mrr,
        arr: mrr * 12,
        arpu: activeClients > 0 ? Math.round(mrr / activeClients) : 0,
        thisMonth: (revenueThisMonth._sum.amount || 0) / 100,
        unpaidCount: unpaidInvoices,
        unpaidAmount: (unpaidAmount._sum.amount || 0) / 100,
      },
      plans: planCounts,
      leads: {
        thisMonth: leadsThisMonth,
        lastMonth: leadsLastMonth,
        total: totalSiteLeads,
        byStatus: siteLeadsByStatus,
        conversionRate: totalSiteLeads > 0 ? Math.round((siteLeadsByStatus.converted / totalSiteLeads) * 100) : 0,
      },
    });
  } catch (error) {
    console.error("Erreur stats:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
