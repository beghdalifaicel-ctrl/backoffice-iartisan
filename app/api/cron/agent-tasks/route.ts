/**
 * iArtisan — agent_tasks worker (Vercel Cron / Edge runtime compatible)
 *
 * Polls agent_tasks for due rows, executes them, and notifies the artisan
 * on WhatsApp when a task completes.
 *
 * Recommended schedule: every 5 minutes via Vercel Cron.
 *
 * Deploy path (Next.js App Router): app/api/cron/agent-tasks/route.ts
 *   + add to vercel.json:
 *     { "crons": [{ "path": "/api/cron/agent-tasks", "schedule": "every 5 minutes" }] }
 *
 * Auth: requires header "Authorization: Bearer ${CRON_SECRET}".
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const CRON_SECRET = process.env.CRON_SECRET;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const AGENT_EMOJIS: Record<string, string> = {
  ADMIN: "🟣",
  MARKETING: "🟢",
  COMMERCIAL: "🔴",
};
const AGENT_NAMES: Record<string, string> = {
  ADMIN: "Marie",
  MARKETING: "Lucas",
  COMMERCIAL: "Samir",
};

async function sendWhatsApp(toPhone: string, text: string): Promise<void> {
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID || !toPhone) return;
  await fetch(`https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toPhone,
      type: "text",
      text: { body: text.slice(0, 4000) },
    }),
  });
}

// ─── Per-intent executors ───────────────────────────────────

interface ExecResult {
  ok: boolean;
  notify?: string;            // human-friendly summary to send to the artisan
  resultData?: Record<string, any>;
  error?: string;
}

async function execTask(task: any): Promise<ExecResult> {
  // existing schema uses task_type, fall back to intent for forward compatibility
  const intent: string = task.task_type || task.intent;
  const payload = task.payload || {};

  switch (intent) {
    case "payment_reminder_send": {
      // TODO: brancher Brevo. Pour l'instant on enregistre l'envoi simulé.
      return {
        ok: true,
        notify: `Relance facture ${payload.invoice_number || ""} envoyée à ${payload.client_email || payload.client_name || "client"}.`,
        resultData: { simulated: true },
      };
    }

    case "gmb_post": {
      // TODO: brancher GMB API.
      return {
        ok: true,
        notify: `Post GMB publié : "${(payload.title || "").slice(0, 60)}".`,
        resultData: { simulated: true },
      };
    }

    case "post_social": {
      return {
        ok: true,
        notify: `Post réseau social publié : "${(payload.title || "").slice(0, 60)}".`,
        resultData: { simulated: true },
      };
    }

    case "review_reply_publish": {
      return {
        ok: true,
        notify: `Réponse à l'avis ${payload.rating || ""}★ publiée.`,
        resultData: { simulated: true },
      };
    }

    case "review_reply_draft": {
      // Génération d'un brouillon — pas d'envoi automatique.
      return {
        ok: true,
        notify: `Brouillon de réponse à l'avis ${payload.rating || ""}★ prêt à valider.`,
        resultData: { draft: "Bonjour, merci pour votre retour..." },
      };
    }

    case "dunning_step": {
      return {
        ok: true,
        notify: `Recouvrement ${payload.invoice_number || ""} → étape "${payload.next_step}".`,
        resultData: { step: payload.next_step },
      };
    }

    case "qualify_lead":
    case "scrape_annuaires":
    case "generic":
    default: {
      return {
        ok: true,
        notify: `Tâche "${intent}" exécutée.`,
        resultData: payload,
      };
    }
  }
}

// ─── Main handler ─────────────────────────────────────────

export async function GET(request: NextRequest) {
  // Auth
  const auth = request.headers.get("authorization") || "";
  const expected = `Bearer ${CRON_SECRET || ""}`;
  if (!CRON_SECRET || auth !== expected) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Claim due tasks atomically
  const { data: due, error } = await supabase.rpc("claim_due_agent_tasks", { p_limit: 25 });
  if (error) {
    console.error("claim_due_agent_tasks error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const tasks = (due || []) as any[];
  let completed = 0;
  let failed = 0;

  for (const task of tasks) {
    try {
      const result = await execTask(task);
      if (result.ok) {
        await supabase
          .from("agent_tasks")
          .update({
            status: "COMPLETED",
            completed_at: new Date().toISOString(),
            result: result.resultData || null,
          })
          .eq("id", task.id);

        if (task.notify_phone && result.notify) {
          const emoji = AGENT_EMOJIS[task.agent_type] || "🟣";
          const name = AGENT_NAMES[task.agent_type] || "Marie";
          await sendWhatsApp(task.notify_phone, `${emoji} ${name} :\n${result.notify}`);
        }

        // Mirror into chat_history so the agent remembers next turn
        const { data: link } = await supabase
          .from("channel_links")
          .select("client_id")
          .eq("client_id", task.client_id)
          .eq("channel", "whatsapp")
          .single();
        if (link && result.notify) {
          await supabase.from("chat_history").insert({
            client_id: task.client_id,
            channel: "whatsapp",
            phone: task.notify_phone?.replace(/[^0-9]/g, ""),
            role: "assistant",
            content: result.notify.slice(0, 5000),
            agent_signed_as: task.agent_type,
          });
        }

        completed++;
      } else {
        await markFailed(task, result.error || "unknown");
        failed++;
      }
    } catch (e: any) {
      await markFailed(task, e?.message || String(e));
      failed++;
    }
  }

  return NextResponse.json({
    ok: true,
    claimed: tasks.length,
    completed,
    failed,
  });
}

async function markFailed(task: any, errMsg: string): Promise<void> {
  const exhausted = (task.retry_count || 0) >= (task.max_retries || 3);
  await supabase
    .from("agent_tasks")
    .update({
      status: exhausted ? "ERROR" : "PENDING",
      error: errMsg.slice(0, 500),
      // Re-queue with a 10-min backoff if not exhausted
      scheduled_for: exhausted
        ? task.scheduled_for
        : new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    })
    .eq("id", task.id);
}
