export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stripe, PLANS } from "@/lib/stripe";
import bcrypt from "bcryptjs";

// POST /api/client/auth/signup — Self-service signup + Stripe Checkout
export async function POST(req: NextRequest) {
  try {
    const { firstName, lastName, email, phone, company, metier, ville, plan, password } = await req.json();

    // Validation
    if (!firstName || !lastName || !email || !password) {
      return NextResponse.json({ error: "Prénom, nom, email et mot de passe requis" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Mot de passe minimum 6 caractères" }, { status: 400 });
    }

    const planKey = (plan || "ESSENTIEL") as keyof typeof PLANS;
    if (!PLANS[planKey]) {
      return NextResponse.json({ error: "Plan invalide" }, { status: 400 });
    }

    // Check existing
    const existing = await prisma.client.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Un compte existe déjà avec cet email" }, { status: 409 });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create Stripe customer
    const customer = await stripe.customers.create({
      email,
      name: `${firstName} ${lastName}`,
      metadata: { company: company || "", metier: metier || "", ville: ville || "" },
    });

    // Essai gratuit 14 jours sur TOUS les plans
    const hasTrial = true;
    const hasSetupFee = PLANS[planKey].setup > 0;

    // Create client in DB using raw SQL to bypass Prisma enum mapping bug
    // (Prisma v5.22 transforms enum params even in $executeRawUnsafe)
    // IMPORTANT: plan and status are inlined in SQL (whitelist-validated) to avoid Prisma enum interception
    const clientId = `c${Date.now().toString(36)}${Math.random().toString(36).substring(2, 10)}`;
    const now = new Date();
    const trialEnd = hasTrial ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null;
    const statusVal = hasTrial ? "TRIAL" : "ACTIVE";
    const companyVal = company || `${firstName} ${lastName}`;

    // Whitelist validation to prevent SQL injection
    const validPlans = ["ESSENTIEL", "PRO", "MAX"];
    const validStatuses = ["TRIAL", "ACTIVE", "INACTIVE", "CHURNED"];
    if (!validPlans.includes(planKey)) throw new Error("Invalid plan");
    if (!validStatuses.includes(statusVal)) throw new Error("Invalid status");

    await prisma.$executeRawUnsafe(
      `INSERT INTO clients (
        id, "createdAt", "updatedAt", "firstName", "lastName", email, phone,
        company, metier, ville, plan, status, "trialEndsAt", "passwordHash",
        "stripeCustomerId", "googleReviewCount", "sitePublished", onboarding_completed
      ) VALUES (
        $1, $2, $2, $3, $4, $5, $6, $7, $8, $9,
        '${planKey}'::"Plan", '${statusVal}'::"ClientStatus", $10, $11, $12, 0, false, false
      )`,
      clientId, now, firstName, lastName, email, phone || null, companyVal,
      metier || "", ville || "", trialEnd, passwordHash, customer.id
    );

    const client = { id: clientId };

    // Create Stripe Checkout session
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.iartisan.io";

    const lineItems: any[] = [{ price: PLANS[planKey].priceId, quantity: 1 }];
    const checkoutParams: any = {
      customer: customer.id,
      mode: "subscription",
      line_items: lineItems,
      success_url: `${appUrl}/api/client/auth/stripe-callback?session_id={CHECKOUT_SESSION_ID}&client_id=${client.id}`,
      cancel_url: `${appUrl}/client/signup?canceled=true`,
      metadata: {
        clientId: client.id,
        plan: planKey,
      },
      allow_promotion_codes: true,
    };

    // Essai gratuit 14 jours sur tous les plans
    if (hasTrial) {
      checkoutParams.subscription_data = { trial_period_days: 14 };
    }
    // TODO(Phase 2 J21) — Frais de mise en service.
    // Stripe Checkout Session mode=subscription ne supporte ni `invoice_items` ni
    // `add_invoice_items` dans `subscription_data`. Pour facturer le setup fee à la
    // fin du trial, mettre en place un webhook `customer.subscription.trial_will_end`
    // qui crée un invoice item via stripe.invoiceItems.create({ customer, price_data })
    // avant que la première facture soit générée.
    // En attendant : le setup fee n'est PAS facturé. Logguer pour suivi.
    if (hasSetupFee) {
      console.warn(
        `[signup] Setup fee de ${PLANS[planKey].setup}c (${PLANS[planKey].name}) ` +
        `non facturé pour client ${clientId} — webhook trial_will_end à implémenter (J21)`
      );
    }

    const session = await stripe.checkout.sessions.create(checkoutParams);

    return NextResponse.json({
      success: true,
      checkoutUrl: session.url,
      clientId: client.id,
    });
  } catch (error: any) {
    console.error("Signup error:", error);
    // If Stripe error, try to give useful message
    if (error.type === "StripeInvalidRequestError") {
      return NextResponse.json({ error: "Erreur de configuration paiement. Contactez le support." }, { status: 500 });
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
