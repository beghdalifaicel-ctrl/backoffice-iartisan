export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";

// GET /api/health — liveness probe pour Upptime / monitoring externe.
// Pas d'auth, pas de DB, pas d'appel externe : doit répondre en quelques ms.
// Si ça échoue, c'est que le runtime Next.js ou la fonction Vercel est down.
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "backoffice-iartisan",
      ts: new Date().toISOString(),
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "dev",
      env: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
