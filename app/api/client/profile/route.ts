import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireClient } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    const session = await requireClient();
    const client = await prisma.client.findUnique({
      where: { id: session.clientId! },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        company: true,
        metier: true,
        siret: true,
        ville: true,
        codePostal: true,
        adresse: true,
        plan: true,
        status: true,
        googleBusinessUrl: true,
        siteUrl: true,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client non trouvé" }, { status: 404 });
    }

    return NextResponse.json(client);
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireClient();
    const body = await req.json();

    // Champs modifiables par le client
    const allowedFields = [
      "firstName", "lastName", "phone", "company", "metier",
      "siret", "ville", "codePostal", "adresse", "googleBusinessUrl",
    ];

    const data: Record<string, any> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        data[field] = body[field];
      }
    }

    // Changement de mot de passe
    if (body.newPassword) {
      if (!body.currentPassword) {
        return NextResponse.json({ error: "Mot de passe actuel requis" }, { status: 400 });
      }
      const client = await prisma.client.findUnique({
        where: { id: session.clientId! },
        select: { passwordHash: true },
      });
      if (!client?.passwordHash) {
        return NextResponse.json({ error: "Erreur de compte" }, { status: 400 });
      }
      const valid = await bcrypt.compare(body.currentPassword, client.passwordHash);
      if (!valid) {
        return NextResponse.json({ error: "Mot de passe actuel incorrect" }, { status: 401 });
      }
      data.passwordHash = await bcrypt.hash(body.newPassword, 10);
    }

    const updated = await prisma.client.update({
      where: { id: session.clientId! },
      data,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        company: true,
        metier: true,
        ville: true,
      },
    });

    return NextResponse.json({ success: true, client: updated });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    console.error("Profile update error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
