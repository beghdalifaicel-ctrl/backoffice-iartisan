export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendWelcomeEmail } from "@/lib/email";

// POST /api/admin/convert-lead — Convertit un SiteLead en Client
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const { leadId, plan } = await req.json();

    if (!leadId) {
      return NextResponse.json({ error: "leadId requis" }, { status: 400 });
    }

    // 1. Récupérer le SiteLead
    const lead = await prisma.siteLead.findUnique({ where: { id: leadId } });
    if (!lead) {
      return NextResponse.json({ error: "Lead non trouvé" }, { status: 404 });
    }

    if (lead.status === "CONVERTED") {
      return NextResponse.json({ error: "Ce lead a déjà été converti", clientId: lead.convertedToClientId }, { status: 409 });
    }

    // 2. Vérifier que l'email n'existe pas déjà
    const existing = await prisma.client.findUnique({ where: { email: lead.email } });
    if (existing) {
      return NextResponse.json({ error: "Un client avec cet email existe déjà", clientId: existing.id }, { status: 409 });
    }

    // 3. Générer un mot de passe temporaire
    const tempPassword = crypto.randomBytes(4).toString("hex"); // 8 chars hex
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // 4. Créer le Client
    const client = await prisma.client.create({
      data: {
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        phone: lead.phone,
        company: lead.company || `${lead.firstName} ${lead.lastName}`,
        metier: lead.metier,
        ville: lead.ville,
        plan: plan || lead.plan || "ESSENTIEL",
        status: "TRIAL",
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 jours
        passwordHash,
      },
    });

    // 5. Mettre à jour le SiteLead comme converti
    await prisma.siteLead.update({
      where: { id: leadId },
      data: {
        status: "CONVERTED",
        convertedToClientId: client.id,
      },
    });

    // Envoyer l'email de bienvenue avec les identifiants
    await sendWelcomeEmail(client.email, {
      firstName: client.firstName,
      tempPassword,
      plan: client.plan,
    });

    return NextResponse.json({
      success: true,
      client: {
        id: client.id,
        email: client.email,
        firstName: client.firstName,
        lastName: client.lastName,
        company: client.company,
        plan: client.plan,
      },
      tempPassword,
      loginUrl: `https://app.iartisan.io/client/login`,
      message: `Compte créé. Un email avec les identifiants a été envoyé à ${client.email}.`,
    });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    console.error("Convert lead error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
