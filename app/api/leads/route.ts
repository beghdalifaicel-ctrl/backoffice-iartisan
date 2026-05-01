export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendAdminNotification } from "@/lib/email";

// CORS headers for cross-origin requests from iartisan.io
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// OPTIONS /api/leads — Preflight CORS
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// POST /api/leads — Formulaire public (depuis iartisan.io ou Google Ads)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { firstName, lastName, email, phone, company, metier, ville, plan, source } = body;

    // Validation
    if (!firstName || !lastName || !email || !metier || !ville) {
      return NextResponse.json({ error: "Champs obligatoires manquants" }, { status: 400, headers: corsHeaders });
    }

    const lead = await prisma.siteLead.create({
      data: {
        firstName,
        lastName,
        email,
        phone: phone || null,
        company: company || `${firstName} ${lastName}`,
        metier,
        ville,
        plan: plan || "ESSENTIEL",
        source: source || null,
        status: "NEW",
      },
    });

    // Notification admin : nouveau prospect
    await sendAdminNotification(`Nouveau prospect - ${firstName} ${lastName}`, {
      title: "Nouveau prospect iArtisan",
      details: {
        "Nom": `${firstName} ${lastName}`,
        "Email": email,
        "Téléphone": phone || "Non renseigné",
        "Métier": metier,
        "Ville": ville,
        "Plan souhaité": plan || "Essentiel",
        "Source": source || "Direct",
      },
      ctaLabel: "Voir les leads",
      ctaUrl: "https://app.iartisan.io/admin",
    });

    return NextResponse.json({ success: true, id: lead.id }, { status: 201, headers: corsHeaders });
  } catch (error: any) {
    console.error("Erreur création lead:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500, headers: corsHeaders });
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
