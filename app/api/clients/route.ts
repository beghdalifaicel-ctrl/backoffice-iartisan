import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSubscription, PLANS } from "@/lib/stripe";

// GET /api/clients — Liste des clients
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const plan = searchParams.get("plan");
    const search = searchParams.get("q");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const where: any = {};
    if (status) where.status = status;
    if (plan) where.plan = plan;
    if (search) {
      where.OR = [
        { company: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { ville: { contains: search, mode: "insensitive" } },
      ];
    }

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { leads: true, invoices: true } },
        },
      }),
      prisma.client.count({ where }),
    ]);

    return NextResponse.json({ clients, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/clients — Créer un client + abonnement Stripe
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { firstName, lastName, email, phone, company, metier, siret, ville, codePostal, adresse, plan } = body;

    if (!firstName || !lastName || !email || !company || !metier || !ville || !plan) {
      return NextResponse.json({ error: "Champs obligatoires manquants" }, { status: 400 });
    }

    // Créer l'abonnement Stripe
    const planKey = plan as keyof typeof PLANS;
    const { customerId, subscription } = await createSubscription(email, `${firstName} ${lastName}`, planKey);

    // Créer le client en base
    const client = await prisma.client.create({
      data: {
        firstName,
        lastName,
        email,
        phone,
        company,
        metier,
        siret,
        ville,
        codePostal,
        adresse,
        plan: planKey,
        status: "TRIAL",
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // +14 jours
        stripeCustomerId: customerId,
        stripeSubscriptionId: (subscription as any).id,
      },
    });

    return NextResponse.json({ success: true, client }, { status: 201 });
  } catch (error: any) {
    console.error("Erreur création client:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
