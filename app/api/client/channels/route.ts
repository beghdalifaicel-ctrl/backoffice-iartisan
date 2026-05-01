export const dynamic = "force-dynamic";
/**
 * Client Channels API
 * GET  — List connected channels (Telegram, WhatsApp)
 * DELETE — Disconnect a channel (sets is_active = false)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireClient } from "@/lib/auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const session = await requireClient();

    const { data: channels, error } = await supabase
      .from("channel_links")
      .select("channel, channel_user_id, display_name, is_active, linked_at, phone")
      .eq("client_id", session.clientId!)
      .eq("is_active", true)
      .order("linked_at", { ascending: false });

    if (error) {
      console.error("Channels fetch error:", error);
      return NextResponse.json({ channels: [] });
    }

    return NextResponse.json({ channels: channels || [] });
  } catch {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireClient();
    const { channel } = await request.json();

    if (!channel || !["telegram", "whatsapp"].includes(channel)) {
      return NextResponse.json({ error: "Canal invalide" }, { status: 400 });
    }

    const { error } = await supabase
      .from("channel_links")
      .update({ is_active: false })
      .eq("client_id", session.clientId!)
      .eq("channel", channel);

    if (error) {
      console.error("Channel disconnect error:", error);
      return NextResponse.json({ error: "Erreur lors de la déconnexion" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, channel });
  } catch {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
}
