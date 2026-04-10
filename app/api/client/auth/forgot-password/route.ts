import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/client/auth/forgot-password — Demande de reset
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email requis" }, { status: 400 });
    }

    // Vérifier que le client existe
    const client = await prisma.client.findUnique({ where: { email } });

    // Toujours retourner succès (sécurité : ne pas révéler si l'email existe)
    if (!client) {
      return NextResponse.json({ success: true });
    }

    // Générer un nouveau mot de passe temporaire
    const newPassword = crypto.randomBytes(4).toString("hex"); // 8 chars
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Stocker la demande de reset
    const token = crypto.randomBytes(16).toString("hex");
    await supabase.from("password_resets").insert({
      client_id: client.id,
      email: client.email,
      token,
      new_password: newPassword, // Stocké en clair pour que l'admin puisse le communiquer
    });

    // Mettre à jour le mot de passe directement
    await prisma.client.update({
      where: { id: client.id },
      data: { passwordHash },
    });

    // TODO: Envoyer l'email avec le nouveau mot de passe quand Resend sera configuré
    // Pour l'instant, le nouveau mdp est visible dans la table password_resets (admin)

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
