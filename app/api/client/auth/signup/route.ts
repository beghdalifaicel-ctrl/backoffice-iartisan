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

    // Essai gratuit seulement sur Pro et Max, pas sur Essentiel
    const hasTrial = planKey !== "ESSENTIEL";
    const hasSetupFee = PLANS[planKey].setup > 0;

    // Create client in DB
    const client = await prisma.client.create({
      data: {
        firstName,
        lastName,
        email,
        phone: phone || null,
        company: company || `${firstName} ${lastName}`,
        metier: metier || null,
        ville: ville || null,
        plan: planKey,
        status: hasTrial ? "TRIAL" : "ACTIVE",
        trialEndsAt: hasTrial ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null,
        passwordHash,
        stripeCustomerId: customer.id,
      },
    });

    // Create Stripe Checkout session
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.iartisan.io";

    // Build line items: subscription + optional setup fee
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

    // Ajouter l'essai gratuit seulement pour Pro et Max
    if (hasTrial) {
      checkoutParams.subscription_data = { trial_period_days: 14 };
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
