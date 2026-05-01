export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireClient } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

export async function GET() {
  try {
    const session = await requireClient();
    const clientId = session.clientId!;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Leads par mois (6 derniers mois) pour le graphique
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const [client, leadsThisMonth, leadsLastMonth, leadsTotal, leadsByStatus, invoices, leadsMonthly] =
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
            stripeCustomerId: true,
            stripeSubscriptionId: true,
            createdAt: true,
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
        // Leads regroupés par mois (6 derniers mois)
        prisma.lead.findMany({
          where: { clientId, createdAt: { gte: sixMonthsAgo } },
          select: { createdAt: true, status: true },
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

    // ─── Graphique leads par mois ───────────────────────────────────────
    const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
    const leadsChart: { month: string; leads: number; won: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthLeads = leadsMonthly.filter((l) => {
        const ld = new Date(l.createdAt);
        return ld.getFullYear() === d.getFullYear() && ld.getMonth() === d.getMonth();
      });
      leadsChart.push({
        month: monthNames[d.getMonth()],
        leads: monthLeads.length,
        won: monthLeads.filter((l) => l.status === "WON").length,
      });
    }

    // ─── Données Stripe enrichies ───────────────────────────────────────
    let subscription: any = null;
    if (client.stripeSubscriptionId) {
      try {
        const sub = await stripe.subscriptions.retrieve(client.stripeSubscriptionId);
        subscription = {
          status: sub.status,
          currentPeriodStart: new Date(sub.current_period_start * 1000).toISOString(),
          currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
        };
      } catch (e) {
        // Stripe non dispo, pas grave
      }
    }

    // ─── Prochaine facture Stripe ───────────────────────────────────────
    let upcomingInvoice: any = null;
    if (client.stripeCustomerId) {
      try {
        const upcoming = await stripe.invoices.retrieveUpcoming({
          customer: client.stripeCustomerId,
        });
        upcomingInvoice = {
          amount: upcoming.amount_due,
          date: upcoming.next_payment_attempt
            ? new Date(upcoming.next_payment_attempt * 1000).toISOString()
            : null,
        };
      } catch (e) {
        // Pas de prochaine facture (trial, etc.)
      }
    }

    return NextResponse.json({
      client: {
        ...client,
        stripeCustomerId: undefined,
        stripeSubscriptionId: undefined,
      },
      leads: {
        thisMonth: leadsThisMonth,
        lastMonth: leadsLastMonth,
        total: leadsTotal,
        byStatus: statusCounts,
        conversionRate,
      },
      leadsChart,
      subscription,
      upcomingInvoice,
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
