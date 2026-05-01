export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createToken } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email et mot de passe requis" }, { status: 400 });
    }

    const client = await prisma.client.findUnique({ where: { email } });

    if (!client || !client.passwordHash) {
      return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, client.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
    }

    const token = await createToken({
      email: client.email,
      role: "client",
      clientId: client.id,
    });

    // Vérifier si l'onboarding est complété (via Supabase car champ pas dans Prisma)
    let needsOnboarding = true;
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const { data } = await supabase
        .from("clients")
        .select("onboarding_completed")
        .eq("id", client.id)
        .single();
      needsOnboarding = !data?.onboarding_completed;
    } catch {}

    const res = NextResponse.json({
      success: true,
      client: {
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        company: client.company,
        plan: client.plan,
      },
      redirectTo: needsOnboarding ? "/client/onboarding" : "/client",
    });

    res.cookies.set("ia-session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 jours
      path: "/",
    });

    return res;
  } catch (error: any) {
    console.error("Client login error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
