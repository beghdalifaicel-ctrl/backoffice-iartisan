export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createToken } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    // Vérifier que c'est l'admin
    if (email !== process.env.ADMIN_EMAIL) {
      return NextResponse.json({ error: "Identifiants incorrects" }, { status: 401 });
    }

    // Vérifier le mot de passe
    const validPassword = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH!);
    if (!validPassword) {
      return NextResponse.json({ error: "Identifiants incorrects" }, { status: 401 });
    }

    // Créer le token JWT
    const token = await createToken({ email, role: "admin" });

    // Répondre avec le cookie
    const response = NextResponse.json({ success: true });
    response.cookies.set("ia-session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 jours
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Erreur login:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
