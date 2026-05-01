export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { exchangeGmbCode, verifyState } from "@/lib/integrations/gmb";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://iartisan.io";

/**
 * GET /api/oauth/gmb/cb
 *
 * OAuth2 callback from Google. Validates the HMAC-signed state, exchanges the
 * authorization code for tokens, encrypts and persists the refresh_token, then
 * redirects the user back to /dashboard with a status query string.
 *
 * Query params (from Google):
 *   - code     : authorization code (success path)
 *   - state    : our signed state, must round-trip
 *   - error    : OAuth error code (failure path, e.g. access_denied)
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");

  const dashboardUrl = (params: Record<string, string>) =>
    new URL(`/onboarding-gmb?${new URLSearchParams(params).toString()}`, APP_URL);

  // User clicked "Cancel" or Google rejected
  if (oauthError) {
    return NextResponse.redirect(dashboardUrl({ gmb: "error", message: oauthError }));
  }

  if (!code || !state) {
    return NextResponse.redirect(dashboardUrl({ gmb: "error", message: "missing_params" }));
  }

  // Validate signed state (anti-CSRF + extract clientId)
  const stateCheck = verifyState(state);
  if (!stateCheck.ok) {
    return NextResponse.redirect(dashboardUrl({ gmb: "error", message: stateCheck.error }));
  }

  // Exchange code → tokens, fetch GMB account+location, encrypt refresh_token, persist
  const result = await exchangeGmbCode(code, stateCheck.clientId);
  if (!result.success) {
    return NextResponse.redirect(dashboardUrl({ gmb: "error", message: result.error }));
  }

  return NextResponse.redirect(dashboardUrl({ gmb: "connected" }));
}
