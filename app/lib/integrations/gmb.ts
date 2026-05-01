/**
 * Google Business Profile (GMB) Integration for iArtisan — J14
 *
 * - OAuth2 flow with HMAC-signed state (anti-CSRF)
 * - Refresh tokens encrypted at rest via Postgres pgcrypto + Supabase Vault
 *   (functions encrypt_gmb_token / decrypt_gmb_token, callable via supabase.rpc)
 * - Access tokens are NEVER persisted — refreshed on demand at every API call
 *
 * Tables: public.gmb_credentials, public.gmb_post_logs, public.gmb_review_response_logs
 * RLS: enabled with no policies → service_role only (this module bypasses via service_role key)
 */

import { createClient } from "@supabase/supabase-js";
import { createHmac, randomUUID, timingSafeEqual } from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const GMB_CLIENT_ID = process.env.GMB_OAUTH_CLIENT_ID!;
const GMB_CLIENT_SECRET = process.env.GMB_OAUTH_CLIENT_SECRET!;
const GMB_REDIRECT_URI = process.env.GMB_OAUTH_REDIRECT_URI!;
const GMB_STATE_SECRET = process.env.GMB_STATE_SECRET!;

const SCOPES = [
  "https://www.googleapis.com/auth/business.manage",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
].join(" ");

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes — enough for slow consent screens

// ───────────────────────────────────────────────────────────────────────────
// HMAC state signing (anti-CSRF + carries clientId across the OAuth round-trip)
// ───────────────────────────────────────────────────────────────────────────

export function signState(clientId: string): string {
  const nonce = randomUUID();
  const ts = Date.now();
  const payload = `${clientId}:${nonce}:${ts}`;
  const sig = createHmac("sha256", GMB_STATE_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function verifyState(
  state: string,
):
  | { ok: true; clientId: string }
  | { ok: false; error: "bad_state_format" | "bad_state_sig" | "state_expired" | "state_decode_error" } {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length !== 4) return { ok: false, error: "bad_state_format" };
    const [clientId, nonce, ts, sig] = parts;
    const payload = `${clientId}:${nonce}:${ts}`;
    const expected = createHmac("sha256", GMB_STATE_SECRET).update(payload).digest("hex");

    const sigBuf = Buffer.from(sig, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expectedBuf.length) return { ok: false, error: "bad_state_sig" };
    if (!timingSafeEqual(sigBuf, expectedBuf)) return { ok: false, error: "bad_state_sig" };

    if (Date.now() - Number(ts) > STATE_TTL_MS) return { ok: false, error: "state_expired" };

    return { ok: true, clientId };
  } catch {
    return { ok: false, error: "state_decode_error" };
  }
}

// ───────────────────────────────────────────────────────────────────────────
// OAuth URL construction
// ───────────────────────────────────────────────────────────────────────────

export function getGmbAuthUrl(clientId: string): string {
  const params = new URLSearchParams({
    client_id: GMB_CLIENT_ID,
    redirect_uri: GMB_REDIRECT_URI,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline", // required to get a refresh_token
    prompt: "consent", // forces consent screen → refresh_token guaranteed even on re-auth
    state: signState(clientId),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// ───────────────────────────────────────────────────────────────────────────
// Code → tokens exchange + persistence
// ───────────────────────────────────────────────────────────────────────────

interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

interface GmbAccount {
  name: string; // "accounts/1234567890"
  type?: string;
  accountName?: string;
}

interface GmbLocation {
  name: string; // "locations/987654321"
  title?: string;
  storefrontAddress?: unknown;
  primaryPhone?: string;
}

export async function exchangeGmbCode(
  code: string,
  clientId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  // 1. Exchange authorization code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GMB_CLIENT_ID,
      client_secret: GMB_CLIENT_SECRET,
      redirect_uri: GMB_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  const tokens = (await tokenRes.json()) as GoogleTokenResponse;

  if (!tokenRes.ok) {
    return {
      success: false,
      error: tokens.error_description || tokens.error || `token_exchange_failed_${tokenRes.status}`,
    };
  }
  if (!tokens.refresh_token) {
    // Edge case: user has previously authorized without prompt=consent
    return { success: false, error: "no_refresh_token_returned" };
  }
  if (!tokens.access_token) {
    return { success: false, error: "no_access_token_returned" };
  }

  // 2. Fetch the user's GMB account (usually 1)
  const accountsRes = await fetch(
    "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
    { headers: { Authorization: `Bearer ${tokens.access_token}` } },
  );
  const accountsBody = (await accountsRes.json()) as { accounts?: GmbAccount[]; error?: { message?: string } };
  if (!accountsRes.ok) {
    return { success: false, error: accountsBody.error?.message || `accounts_fetch_${accountsRes.status}` };
  }
  if (!accountsBody.accounts?.length) {
    return { success: false, error: "no_gmb_account_found" };
  }
  const primaryAccount = accountsBody.accounts[0].name;

  // 3. Fetch the locations under that account
  const locationsRes = await fetch(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${primaryAccount}/locations` +
      `?readMask=name,title,storefrontAddress,primaryPhone&pageSize=10`,
    { headers: { Authorization: `Bearer ${tokens.access_token}` } },
  );
  const locationsBody = (await locationsRes.json()) as { locations?: GmbLocation[]; error?: { message?: string } };
  if (!locationsRes.ok) {
    return { success: false, error: locationsBody.error?.message || `locations_fetch_${locationsRes.status}` };
  }
  if (!locationsBody.locations?.length) {
    return { success: false, error: "no_gmb_location_found" };
  }
  const primaryLocation = locationsBody.locations[0].name;

  // 4. Encrypt the refresh_token via Postgres function (uses Vault key)
  const { data: encrypted, error: encryptError } = await supabase.rpc("encrypt_gmb_token", {
    plaintext: tokens.refresh_token,
  });
  if (encryptError || !encrypted) {
    return { success: false, error: encryptError?.message || "encryption_failed" };
  }

  // 5. Upsert into gmb_credentials (1 row per client)
  const { error: upsertError } = await supabase.from("gmb_credentials").upsert(
    {
      client_id: clientId,
      refresh_token_encrypted: encrypted as unknown as Buffer,
      gmb_account_name: primaryAccount,
      gmb_location_name: primaryLocation,
      scopes_granted: tokens.scope || SCOPES,
      connected_at: new Date().toISOString(),
      last_refreshed_at: new Date().toISOString(),
      revoked_at: null,
    },
    { onConflict: "client_id" },
  );

  if (upsertError) {
    return { success: false, error: `db_upsert_failed: ${upsertError.message}` };
  }

  return { success: true };
}

// ───────────────────────────────────────────────────────────────────────────
// Get a fresh access_token by refreshing the stored refresh_token
// (Lucas worker calls this before every GMB API call)
// ───────────────────────────────────────────────────────────────────────────

export async function getGmbAccessToken(clientId: string): Promise<string | null> {
  // 1. Load encrypted refresh_token (rejecting revoked rows)
  const { data: cred, error: credError } = await supabase
    .from("gmb_credentials")
    .select("refresh_token_encrypted")
    .eq("client_id", clientId)
    .is("revoked_at", null)
    .maybeSingle();

  if (credError || !cred) return null;

  // 2. Decrypt via Postgres function (uses Vault key)
  const { data: refreshToken, error: decryptError } = await supabase.rpc("decrypt_gmb_token", {
    ciphertext: cred.refresh_token_encrypted,
  });
  if (decryptError || !refreshToken) return null;

  // 3. Exchange refresh_token → fresh access_token
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GMB_CLIENT_ID,
      client_secret: GMB_CLIENT_SECRET,
      refresh_token: refreshToken as string,
      grant_type: "refresh_token",
    }),
  });
  const data = (await res.json()) as GoogleTokenResponse;

  if (!res.ok || !data.access_token) {
    // Refresh failed — likely user revoked grant on Google side. Mark credential revoked.
    await supabase
      .from("gmb_credentials")
      .update({ revoked_at: new Date().toISOString() })
      .eq("client_id", clientId);
    return null;
  }

  // 4. Touch last_refreshed_at for monitoring
  await supabase
    .from("gmb_credentials")
    .update({ last_refreshed_at: new Date().toISOString() })
    .eq("client_id", clientId);

  return data.access_token;
}

// ───────────────────────────────────────────────────────────────────────────
// Public helpers
// ───────────────────────────────────────────────────────────────────────────

export async function isGmbConnected(clientId: string): Promise<boolean> {
  const { data } = await supabase
    .from("gmb_credentials")
    .select("client_id")
    .eq("client_id", clientId)
    .is("revoked_at", null)
    .maybeSingle();
  return !!data;
}

export interface GmbConnectionInfo {
  connected: boolean;
  gmb_location_name?: string;
  connected_at?: string;
  last_refreshed_at?: string;
}

export async function getGmbConnectionInfo(clientId: string): Promise<GmbConnectionInfo> {
  const { data } = await supabase
    .from("gmb_credentials")
    .select("gmb_location_name, connected_at, last_refreshed_at")
    .eq("client_id", clientId)
    .is("revoked_at", null)
    .maybeSingle();
  if (!data) return { connected: false };
  return {
    connected: true,
    gmb_location_name: data.gmb_location_name,
    connected_at: data.connected_at,
    last_refreshed_at: data.last_refreshed_at,
  };
}

export async function disconnectGmb(clientId: string): Promise<void> {
  await supabase
    .from("gmb_credentials")
    .update({ revoked_at: new Date().toISOString() })
    .eq("client_id", clientId);
}
