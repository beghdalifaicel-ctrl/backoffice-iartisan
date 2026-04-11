import { NextResponse } from "next/server";
import { requireClient } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";

// POST — Crée une session Stripe Customer Portal et retourne l'URL
export async function POST() {
  try {
    const session = await requireClient();

    const client = await prisma.client.findUnique({
      where: { id: session.clientId! },
      select: { stripeCustomerId: true },
    });

    if (!client?.stripeCustomerId) {
      return NextResponse.json(
        { error: "Aucun abonnement Stripe associé" },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.iartisan.io";

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: client.stripeCustomerId,
      return_url: `${appUrl}/client?page=profil`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    console.error("Billing portal error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
