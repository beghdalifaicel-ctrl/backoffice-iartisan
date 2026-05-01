export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getGmbAuthUrl } from "@/lib/integrations/gmb";
import { verifyAuth } from "@/lib/auth";

/**
 * GET /api/oauth/gmb/start
 *
 * Initiates the Google Business Profile OAuth2 flow for the authenticated client.
 * Generates an HMAC-signed state carrying the clientId, then either:
 *   - Redirects the browser to Google's consent screen (default)
 *   - Returns the authUrl as JSON (when ?json=1 — useful for SPA-style flows)
 */
export async function GET(request: NextRequest) {
  const session = await verifyAuth(request);
  if (!session || !session.clientId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authUrl = getGmbAuthUrl(session.clientId);

  if (request.nextUrl.searchParams.get("json") === "1") {
    return NextResponse.json({ authUrl });
  }
  return NextResponse.redirect(authUrl);
}
