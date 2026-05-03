/**
 * E2E test endpoint — exécute l'orchestrator avec sendMessage/sendDocument
 * mockés pour capturer ce qu'un message WhatsApp réel produirait, sans
 * envoyer chez Meta Cloud API.
 *
 * POST /api/test/e2e?token=<CRON_SECRET>
 * Body : { message: "...", force_agent?: "ADMIN"|"MARKETING"|"COMMERCIAL", client_id?: "..." }
 *
 * Renvoie :
 *   - elapsed_ms
 *   - routed_to (agent qui a traité)
 *   - intent (router decision)
 *   - final_reply (texte qui aurait été envoyé sur WhatsApp)
 *   - messages_sent (tous les emit_status + reply)
 *   - documents_sent (PDF/docx/xlsx envoyés)
 *   - tool_calls (outils appelés ce tour)
 *   - tool_results (succès/échec de chaque tool)
 *   - new_tasks (agent_tasks créées par ce tour)
 *   - new_retries (agent_retries créés si validator a déclenché)
 *
 * Utilise un phone de test (+33000000000) pour ne pas polluer les vraies
 * conversations, mais écrit quand même dans chat_history côté supabase
 * (acceptable pour un endpoint test-only).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { orchestrate } from "@/lib/agents/orchestrator-v4";
import type { AgentType, PlanType } from "@/lib/agents/types";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TEST_PHONE = "+33000000000";
const TEST_NORMALIZED_PHONE = "33000000000";

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  const message = body?.message;
  const forceAgent = body?.force_agent as AgentType | undefined;
  const explicitClientId = body?.client_id as string | undefined;

  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "message (string) required" }, { status: 400 });
  }

  // Choisir le client : explicite > 1er ACTIVE/TRIAL trouvé
  let client: any;
  if (explicitClientId) {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("id", explicitClientId)
      .single();
    if (error || !data) {
      return NextResponse.json(
        { error: `client ${explicitClientId} not found`, details: error?.message },
        { status: 404 }
      );
    }
    client = data;
  } else {
    // Pas de tri par created_at car Prisma camelCase peut casser. On prend
    // n'importe quel client ACTIVE / TRIAL.
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .in("status", ["ACTIVE", "TRIAL"])
      .limit(1);
    if (error) {
      return NextResponse.json(
        { error: "DB query failed", details: error.message, hint: "Vérifie que la table 'clients' existe et est lisible avec service_role." },
        { status: 500 }
      );
    }
    if (!data || data.length === 0) {
      // Fallback : n'importe quel client, peu importe le status
      const { data: anyClient, error: anyErr } = await supabase
        .from("clients")
        .select("*")
        .limit(1);
      if (anyErr || !anyClient || anyClient.length === 0) {
        return NextResponse.json(
          {
            error: "no client found in DB",
            hint: "Crée d'abord un client via l'admin (ou passe client_id dans le body).",
          },
          { status: 500 }
        );
      }
      client = anyClient[0];
    } else {
      client = data[0];
    }
  }

  // Snapshots avant le tour
  const { data: tasksBefore } = await supabase
    .from("agent_tasks")
    .select("id")
    .eq("client_id", client.id);
  const { data: retriesBefore } = await supabase
    .from("agent_retries")
    .select("id")
    .eq("client_id", client.id);
  const tasksBeforeIds = new Set((tasksBefore || []).map((t: any) => t.id));
  const retriesBeforeIds = new Set((retriesBefore || []).map((r: any) => r.id));

  // Capture des sends
  const messagesSent: Array<{ phone: string; text: string }> = [];
  const documentsSent: Array<{
    phone: string;
    url: string;
    filename: string;
    caption?: string;
  }> = [];

  const t0 = Date.now();
  let outcome: any;
  let runError: string | undefined;

  try {
    outcome = await orchestrate({
      client: {
        id: client.id,
        // Pour les tests E2E on force le plan MAX afin d'avoir les 3 agents
        // (ADMIN/MARKETING/COMMERCIAL) disponibles. Sinon force_agent peut
        // être ignoré si le plan réel du client TRIAL est ESSENTIEL.
        plan: "MAX" as PlanType,
        company: client.company,
        metier: client.metier,
        ville: client.ville,
        firstName: client.first_name || client.firstName,
        lastName: client.last_name || client.lastName,
      },
      phone: TEST_PHONE,
      normalizedPhone: TEST_NORMALIZED_PHONE,
      text: message,
      forceAgent,
      sendMessage: async (toPhone, text) => {
        messagesSent.push({ phone: toPhone, text });
      },
      sendDocument: async (toPhone, url, filename, caption) => {
        documentsSent.push({ phone: toPhone, url, filename, caption });
      },
    });
  } catch (err: any) {
    runError = err?.message || String(err);
  }

  const elapsedMs = Date.now() - t0;

  // Snapshots après — diff
  const { data: tasksAfter } = await supabase
    .from("agent_tasks")
    .select("id, task_type, scheduled_for, payload, created_at")
    .eq("client_id", client.id)
    .order("created_at", { ascending: false })
    .limit(20);
  const newTasks = (tasksAfter || []).filter((t: any) => !tasksBeforeIds.has(t.id));

  const { data: retriesAfter } = await supabase
    .from("agent_retries")
    .select(
      "id, agent_signed_as, original_reply, corrected_reply, violations, correction_hint, created_at"
    )
    .eq("client_id", client.id)
    .order("created_at", { ascending: false })
    .limit(5);
  const newRetries = (retriesAfter || []).filter((r: any) => !retriesBeforeIds.has(r.id));

  if (runError) {
    return NextResponse.json(
      {
        ok: false,
        elapsed_ms: elapsedMs,
        error: runError,
        client_id: client.id,
        company: client.company,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    elapsed_ms: elapsedMs,
    client_id: client.id,
    company: client.company,
    routed_to: outcome.routedTo,
    intent: outcome.intent,
    final_reply: outcome.finalReply,
    tool_calls: outcome.toolCalls.map((c: any) => ({ name: c.name, args: c.args })),
    tool_results: outcome.toolResults.map((r: any) => ({
      ok: r.ok,
      summary: r.summary,
      error: r.error,
    })),
    messages_sent: messagesSent,
    documents_sent: documentsSent,
    new_tasks: newTasks,
    new_retries: newRetries,
    artefact_delivered: outcome.artefactDelivered,
  });
}
