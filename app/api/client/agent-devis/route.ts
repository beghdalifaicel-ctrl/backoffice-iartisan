export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireClient } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await requireClient();
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get("status");
    const source = searchParams.get("source");

    const conditions: string[] = [`client_id = $1`];
    const params: any[] = [session.clientId];
    let paramIdx = 2;

    if (status) {
      conditions.push(`status = $${paramIdx}::agent_devis_status`);
      params.push(status);
      paramIdx++;
    }

    if (source) {
      conditions.push(`source = $${paramIdx}::agent_devis_source`);
      params.push(source);
      paramIdx++;
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const agentDevis: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, created_at as "createdAt", updated_at as "updatedAt",
              source, conversation_id as "conversationId",
              message_extract as "messageExtract",
              prospect_name as "prospectName",
              prospect_phone as "prospectPhone",
              prospect_email as "prospectEmail",
              prospect_adresse as "prospectAdresse",
              prospect_ville as "prospectVille",
              objet, lignes,
              total_ht_estime as "totalHtEstime",
              total_ttc_estime as "totalTtcEstime",
              confidence_score as "confidenceScore",
              status, imported_devis_id as "importedDevisId",
              ai_notes as "aiNotes"
       FROM agent_devis ${whereClause}
       ORDER BY created_at DESC`,
      ...params
    );

    return NextResponse.json(agentDevis);
  } catch (e: any) {
    console.error("Erreur agent-devis GET:", e);
    return NextResponse.json({ error: e.message || "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireClient();
    const body = await req.json();

    const result: any[] = await prisma.$queryRawUnsafe(
      `INSERT INTO agent_devis (
        id, client_id, source, conversation_id, message_extract,
        prospect_name, prospect_phone, prospect_email, prospect_adresse, prospect_ville,
        objet, lignes, total_ht_estime, total_ttc_estime, confidence_score,
        status, ai_notes
      ) VALUES (
        gen_random_uuid()::text, $1, $2::agent_devis_source, $3, $4,
        $5, $6, $7, $8, $9,
        $10, $11::jsonb, $12, $13, $14,
        'A_VALIDER'::agent_devis_status, $15
      ) RETURNING id, created_at as "createdAt", prospect_name as "prospectName", objet, status`,
      session.clientId,
      body.source || "WHATSAPP",
      body.conversationId || null,
      body.messageExtract || null,
      body.prospectName,
      body.prospectPhone || null,
      body.prospectEmail || null,
      body.prospectAdresse || null,
      body.prospectVille || null,
      body.objet,
      JSON.stringify(body.lignes || []),
      body.totalHtEstime || 0,
      body.totalTtcEstime || 0,
      body.confidenceScore || 0.8,
      body.aiNotes || null
    );

    return NextResponse.json(result[0], { status: 201 });
  } catch (e: any) {
    console.error("Erreur agent-devis POST:", e);
    return NextResponse.json({ error: e.message || "Erreur serveur" }, { status: 500 });
  }
}
