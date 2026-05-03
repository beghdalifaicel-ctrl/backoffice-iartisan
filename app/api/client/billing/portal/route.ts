export const dynamic = "force-dynamic";
/**
 * Customer Portal Stripe — endpoint WhatsApp-first
 *
 * Pivot 01/05/2026 : plus d'auth web (requireClient supprimé). L'endpoint
 * accepte un numéro de téléphone (E.164 ou normalisé), vérifie qu'il existe
 * en DB, crée une session Stripe Customer Portal et retourne l'URL signée.
 *
 * Cet endpoint est appelé exclusivement par le bot WhatsApp via un outil
 * `getBillingPortalLink(phone)` exposé à Marie. La session Stripe expire
 * automatiquement (~15 min côté Stripe).
 *
 * Contrat :
 *   POST /api/client/billing/portal
 *   Body : { phone: "+33612345678" }
 *   Headers : x-internal-secret = INTERNAL_API_SECRET (protection contre appel externe)
 *   200 : { url: "https://billing.stripe.com/session/..." }
 *   400 : { error: "phone_required" | "client_not_found" | "no_stripe_subscription" }
 *   401 : { error: "unauthorized" }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";

function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

function phoneTail(phone: string): string {
  return normalizePhone(phone).slice(-9);
}

export async function POST(req: NextRequest) {
  // 1. Vérifier le secret interne (l'endpoint n'est pas censé être public)
  const secret = req.headers.get("x-internal-secret");
  if (!secret || secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2. Parser le payload
  let body: { phone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.phone) {
    return NextResponse.json({ error: "phone_required" }, { status: 400 });
  }

  const tail = phoneTail(body.phone);
  if (tail.length !== 9) {
    return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  }

  try {
    // 3. Lookup client par tail des 9 derniers chiffres (tolérance format)
    const candidates = await prisma.client.findMany({
      where: {
        phone: { not: null },
        stripeCustomerId: { not: null },
      },
      select: { id: true, phone: true, stripeCustomerId: true, status: true },
      take: 1000,
    });

    const client = candidates.find(
      (c) => c.phone && phoneTail(c.phone) === tail
    );

    if (!client) {
      return NextResponse.json({ error: "client_not_found" }, { status: 400 });
    }

    if (!client.stripeCustomerId) {
      return NextResponse.json(
        { error: "no_stripe_subscription" },
        { status: 400 }
      );
    }

    // 4. Créer la session Customer Portal
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://iartisan.io";

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: client.stripeCustomerId,
      return_url: `${siteUrl}/done`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error: any) {
    console.error("Billing portal error:", error);
    return NextResponse.json({ error: "stripe_error" }, { status: 500 });
  }
}
