export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { disconnectGmb } from "@/lib/integrations/gmb";
import { verifyAuth } from "@/lib/auth";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://iartisan.io";

/**
 * POST /api/oauth/gmb/disconnect
 *
 * Marks the GMB credential as revoked for the authenticated client.
 * The refresh_token is NOT physically deleted (kept for audit) — just flagged
 * with revoked_at. The client may reconnect later via /api/oauth/gmb/start.
 *
 * Note: this does NOT revoke the grant on Google's side. The user can do that
 * separately at https://myaccount.google.com/permissions if they want a clean
 * slate. Either way, our refresh attempts will fail after revocation here, so
 * no GMB API call will succeed in our name.
 */
export async function POST(request: NextRequest) {
  const session = await verifyAuth(request);
  if (!session || !session.clientId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await disconnectGmb(session.clientId);

  return NextResponse.redirect(new URL("/onboarding-gmb?gmb=disconnected", APP_URL), {
    status: 303, // Required after a POST→redirect to switch to GET
  });
}
