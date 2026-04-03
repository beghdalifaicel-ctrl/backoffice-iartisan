import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST /api/leads — Formulaire public (depuis iartisan.io ou Google Ads)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { firstName, lastName, email, phone, company, metier, ville, plan, source } = body;

    // Validation
    if (!firstName || !lastName || !email || !company || !metier || !ville) {
      return NextResponse.json({ error: "Champs obligatoires manquants" }, { status: 400 });
    }

    const lead = await prisma.siteLead.create({
      data: {
        firstName,
        lastName,
        email,
        phone: phone || null,
        company,
        metier,
        ville,
        plan: plan || "ESSENTIEL",
        status: "NEW",
      },
    });

    // TODO: Envoyer notification WhatsApp / Email à Faicel
    // TODO: Envoyer email de bienvenue au prospect

    return NextResponse.json({ success: true, id: lead.id }, { status: 201 });
  } catch (error: any) {
    console.error("Erreur création lead:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// GET /api/leads — Liste des leads (admin only)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const where = status ? { status: status as any } : {};

    const [leads, total] = await Promise.all([
      prisma.siteLead.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.siteLead.count({ where }),
    ]);

    return NextResponse.json({ leads, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
