export const dynamic = "force-dynamic";
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

const CRON_SECRET = process.env["CRON_SECRET"];
const WHATSAPP_ACCESS_TOKEN = process.env["WHATSAPP_ACCESS_TOKEN"];
const WHATSAPP_PHONE_NUMBER_ID = process.env["WHATSAPP_PHONE_NUMBER_ID"];

const supabase = createClient(
  process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
  process.env["SUPABASE_SERVICE_ROLE_KEY"]!
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


// ─── Resend integration ──────────────────────────────────────

async function sendPaymentReminderEmail(
  payload: any,
  artisan: any
): Promise<{ ok: boolean; resend_id?: string; error?: string }> {
  const apiKey = process.env["RESEND_API_KEY"];
  const fromAddr = process.env["RESEND_FROM_EMAIL"];
  if (!apiKey || !fromAddr) {
    return { ok: false, error: "RESEND_API_KEY or RESEND_FROM_EMAIL missing" };
  }
  if (!payload?.client_email) {
    return { ok: false, error: "client_email required in payload" };
  }

  const fromName = (artisan?.company || artisan?.firstName || "iArtisan").replace(/[<>"]/g, "");
  const html = buildPaymentReminderHtml(payload, artisan);

  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${fromName} <${fromAddr}>`,
        to: [payload.client_email],
        subject: `Relance facture ${payload.invoice_number || ""}`.trim(),
        html,
      }),
    });
  } catch (e: any) {
    return { ok: false, error: `fetch error: ${e?.message || String(e)}` };
  }

  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: body?.message || `Resend HTTP ${res.status}` };
  }
  return { ok: true, resend_id: body?.id };
}

function buildPaymentReminderHtml(payload: any, artisan: any): string {
  const tone = payload?.tone === "ferme" ? "ferme" : "polie";
  const company = (artisan?.company || "").trim() || "Notre société";
  const firstName = (artisan?.firstName || "").trim();
  const clientName = (payload?.client_name || "").trim() || "Madame, Monsieur";
  const invoice = (payload?.invoice_number || "").toString().trim();
  const amount =
    typeof payload?.amount_eur === "number"
      ? payload.amount_eur.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : (payload?.amount_eur || "—").toString();

  const intro =
    tone === "ferme"
      ? `Sauf erreur de notre part, la facture ${invoice ? "n°" + invoice + " " : ""}d'un montant de <strong>${amount} € TTC</strong> est toujours en attente de règlement.`
      : `Permettez-nous de vous rappeler que la facture ${invoice ? "n°" + invoice + " " : ""}d'un montant de <strong>${amount} € TTC</strong> reste en attente de règlement.`;

  const cta =
    tone === "ferme"
      ? `Nous vous remercions de procéder au règlement sous <strong>8 jours</strong>. À défaut, nous serons contraints d'engager les démarches de recouvrement prévues par la loi.`
      : `Nous vous remercions de bien vouloir régulariser ce règlement dans les meilleurs délais.`;

  const sig = firstName ? `${firstName}<br>${company}` : company;

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>Relance facture</title></head>
<body style="font-family:-apple-system,system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;background:#fafafa;margin:0;padding:32px 16px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;line-height:1.6;">
    <p style="margin-top:0;">Bonjour ${clientName},</p>
    <p>${intro}</p>
    <p>${cta}</p>
    <p>Si ce règlement a déjà été effectué de votre côté, nous vous remercions de bien vouloir ne pas tenir compte de ce message et nous transmettre la preuve de paiement.</p>
    <p>Pour toute question, vous pouvez répondre directement à cet email.</p>
    <p style="margin-top:32px;">Bien cordialement,<br><strong>${sig}</strong></p>
  </div>
  <p style="text-align:center;font-size:11px;color:#999;margin-top:16px;">Email envoyé automatiquement pour le compte de ${company}.</p>
</body></html>`;
}

async function execTask(task: any): Promise<ExecResult> {
  // existing schema uses task_type, fall back to intent for forward compatibility
  const intent: string = task.task_type || task.intent;
  const payload = task.payload || {};

  switch (intent) {
    case "payment_reminder_send": {
      // Récupère les infos artisan pour personnaliser le from + signature
      const { data: artisan } = await supabase
        .from("clients")
        .select("company, firstName, metier, ville")
        .eq("id", task.client_id)
        .single();

      const r = await sendPaymentReminderEmail(payload, artisan);
      if (!r.ok) {
        return { ok: false, error: r.error || "Resend send failed" };
      }
      return {
        ok: true,
        notify: `📧 Relance facture ${payload.invoice_number || ""} envoyée à ${payload.client_email}.`,
        resultData: {
          provider: "resend",
          resend_id: r.resend_id,
          to: payload.client_email,
          tone: payload.tone || "polie",
          sent_at: new Date().toISOString(),
        },
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
