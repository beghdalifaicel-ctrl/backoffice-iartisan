export const dynamic = "force-dynamic";
/**
 * iArtisan WhatsApp webhook — v4 Orchestrator
 *
 * Replaces v3 (route-team-chat.ts). The webhook is now a thin transport layer:
 * it parses Meta Cloud API payloads, handles voice/image, and hands off to
 * `orchestrate(...)` which owns routing, tool calls, status streaming,
 * task scheduling and unified history.
 *
 * What changed vs v3 :
 * - No more keyword scoring + broadcast → single agent per turn (router LLM).
 * - Marie now ACTS via tools instead of dispatching ("standardiste").
 * - Engagements ("je publie demain") create real Supabase agent_tasks rows.
 * - chat_history is unified (no agent_type silo).
 * - Status updates streamed during tool execution.
 *
 * Deploy path: app/api/webhooks/whatsapp/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  AgentType,
  PlanType,
  PLAN_AGENTS,
  PLAN_QUOTAS,
  DEFAULT_AGENT_NAMES,
} from "@/lib/agents/types";
import { analyzeImageForQuote } from "@/lib/channels/vision";
import { handleDevisGeneration } from "@/lib/pdf/devis-flow";
import { orchestrate, AGENT_EMOJIS } from "@/lib/agents/orchestrator-v4";

const WHATSAPP_VERIFY_TOKEN =
  process.env["WHATSAPP_VERIFY_TOKEN"] || "iartisan-whatsapp-verify";
const WHATSAPP_ACCESS_TOKEN = process.env["WHATSAPP_ACCESS_TOKEN"];
const WHATSAPP_PHONE_NUMBER_ID = process.env["WHATSAPP_PHONE_NUMBER_ID"];
const GROQ_API_KEY = process.env["GROQ_API_KEY"];

const supabase = createClient(
  process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
  process.env["SUPABASE_SERVICE_ROLE_KEY"]!
);

// ─── Direct agent commands (kept for power users) ────────────

const AGENT_COMMANDS: Record<string, AgentType> = {
  "/marie": "ADMIN",
  "/lucas": "MARKETING",
  "/samir": "COMMERCIAL",
};

function parseAgentCommand(text: string): { command: AgentType | null; remainingText: string } {
  const trimmed = text.trim().toLowerCase();
  for (const [cmd, agent] of Object.entries(AGENT_COMMANDS)) {
    if (trimmed === cmd || trimmed.startsWith(cmd + " ")) {
      return { command: agent, remainingText: text.trim().substring(cmd.length).trim() };
    }
  }
  return { command: null, remainingText: text };
}

// ─── WhatsApp send helpers (Meta Cloud API only) ─────────────

async function sendMessage(toPhone: string, text: string): Promise<void> {
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.warn("WhatsApp Cloud API not configured");
    return;
  }
  const parts = text.length > 4000 ? text.match(/[\s\S]{1,4000}/g) || [text] : [text];
  for (const part of parts) {
    await fetch(`https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toPhone,
        type: "text",
        text: { body: part },
      }),
    });
  }
}

async function sendDocument(
  toPhone: string,
  documentUrl: string,
  filename: string,
  caption?: string
): Promise<void> {
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) return;
  const payload: any = {
    messaging_product: "whatsapp",
    to: toPhone,
    type: "document",
    document: { link: documentUrl, filename },
  };
  if (caption) payload.document.caption = caption;
  await fetch(`https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// ─── Client lookup / link ───────────────────────────────────

async function getClientByPhone(phone: string) {
  const normalized = phone.replace(/[^0-9]/g, "");
  const { data } = await supabase
    .from("channel_links")
    .select("client_id")
    .eq("channel", "whatsapp")
    .eq("channel_user_id", normalized)
    .eq("is_active", true)
    .single();
  if (!data) return null;
  const { data: client } = await supabase
    .from("clients")
    .select("id, plan, company, metier, ville, status, firstName, lastName")
    .eq("id", data.client_id)
    .single();
  return client;
}

async function linkWhatsAppAccount(phone: string, clientId: string, displayName?: string) {
  const normalized = phone.replace(/[^0-9]/g, "");
  const { data: client } = await supabase
    .from("clients")
    .select("id, firstName, company")
    .eq("id", clientId)
    .single();
  if (!client) return null;
  await supabase.from("channel_links").upsert(
    {
      client_id: clientId,
      channel: "whatsapp",
      channel_user_id: normalized,
      display_name: displayName,
      phone,
      is_active: true,
      linked_at: new Date().toISOString(),
    },
    { onConflict: "channel,channel_user_id" }
  );
  return client;
}

// ─── Quota check ────────────────────────────────────────────

async function checkMessageLimit(
  clientId: string,
  plan: PlanType
): Promise<{ allowed: boolean; warning?: string; blockMessage?: string }> {
  const monthlyLimit = PLAN_QUOTAS[plan].messages;
  if (monthlyLimit === -1) return { allowed: true };
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
  const { data, error } = await supabase.rpc("check_and_increment_messages", {
    p_client_id: clientId,
    p_channel: "whatsapp",
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_limit: monthlyLimit,
  });
  if (error) return { allowed: true };
  const usage = data?.messages_used || 0;
  if (usage > monthlyLimit) {
    const planNames: Record<PlanType, string> = {
      ESSENTIEL: "Pro (99/mois)",
      PRO: "Max (179/mois)",
      MAX: "Max",
    };
    return {
      allowed: false,
      blockMessage: `Vous avez atteint votre limite de ${monthlyLimit} messages ce mois-ci.\n\nPassez au plan ${planNames[plan]} pour continuer.\n\niartisan.io/upgrade`,
    };
  }
  if (usage >= Math.floor(monthlyLimit * 0.8)) {
    const remaining = monthlyLimit - usage;
    return {
      allowed: true,
      warning: `\n\n(${remaining} message${remaining > 1 ? "s" : ""} restant${remaining > 1 ? "s" : ""} ce mois — ${usage}/${monthlyLimit})`,
    };
  }
  return { allowed: true };
}

// ─── Voice transcription (Groq Whisper) ─────────────────────

async function transcribeWhatsAppAudio(mediaId: string): Promise<string | null> {
  if (!WHATSAPP_ACCESS_TOKEN) return null;
  const mediaRes = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
  });
  const mediaData = await mediaRes.json();
  if (!mediaData.url) return null;
  const audioRes = await fetch(mediaData.url, {
    headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
  });
  const audioBuffer = await audioRes.arrayBuffer();
  const mimeType = mediaData.mime_type || "audio/ogg";
  if (!GROQ_API_KEY) return null;
  const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "m4a" : "ogg";
  const formData = new FormData();
  formData.append("file", new Blob([audioBuffer], { type: "audio/ogg" }), `voice.${ext}`);
  formData.append("model", "whisper-large-v3-turbo");
  formData.append("language", "fr");
  formData.append("response_format", "text");
  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
    body: formData,
  });
  if (!res.ok) return null;
  return (await res.text()).trim() || null;
}

// ─── Image download ─────────────────────────────────────────

async function downloadWhatsAppImage(
  mediaId: string
): Promise<{ base64: string; mimeType: string } | null> {
  if (!WHATSAPP_ACCESS_TOKEN) return null;
  const mediaRes = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
  });
  const mediaData = await mediaRes.json();
  if (!mediaData.url) return null;
  const imgRes = await fetch(mediaData.url, {
    headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
  });
  const buffer = await imgRes.arrayBuffer();
  return { base64: Buffer.from(buffer).toString("base64"), mimeType: mediaData.mime_type || "image/jpeg" };
}

// ─── Process a single inbound message ───────────────────────

async function processMessage(
  phone: string,
  text: string,
  displayName: string | undefined,
  mediaType?: "audio" | "image",
  mediaId?: string,
  caption?: string
): Promise<void> {
  const normalized = phone.replace(/[^0-9]/g, "");
  const trimmed = (text || "").trim();
  const lower = trimmed.toLowerCase();

  // Link command
  if (trimmed.startsWith("link_") || trimmed.startsWith("Link_")) {
    const clientId = trimmed.replace(/^[Ll]ink_/, "");
    const client = await linkWhatsAppAccount(phone, clientId, displayName);
    if (!client) {
      await sendMessage(phone, "Ce code ne correspond à aucun compte. Vérifie et réessaye.");
      return;
    }
    const plan: PlanType = "ESSENTIEL";
    const teamAgents = PLAN_AGENTS[plan];
    let welcome = `Compte lié ✅\n\nBonjour ${client.firstName || displayName || ""} ! `;
    if (teamAgents.length === 1) {
      welcome += `Je suis ${DEFAULT_AGENT_NAMES.ADMIN}, ton bras droit pour ${client.company}.`;
    } else {
      welcome += `Voici ton équipe pour ${client.company} :\n`;
      for (const t of teamAgents) welcome += `${AGENT_EMOJIS[t]} ${DEFAULT_AGENT_NAMES[t]}\n`;
    }
    welcome += `\nDis-moi ce dont tu as besoin (devis, relance, post Insta, prospects…), j'agis directement.\n\nCommandes : /marie /lucas /samir`;
    await sendMessage(phone, welcome);
    return;
  }

  // Help
  if (["aide", "help", "menu"].includes(lower)) {
    const client = await getClientByPhone(normalized);
    if (!client) {
      await sendMessage(
        phone,
        "Bienvenue sur iArtisan ! Connecte-toi sur iartisan.io > Onboarding pour récupérer ton code de liaison."
      );
      return;
    }
    const plan = client.plan as PlanType;
    const teamAgents = PLAN_AGENTS[plan];
    let helpText = `Ton équipe iArtisan :\n`;
    for (const t of teamAgents) helpText += `${AGENT_EMOJIS[t]} ${DEFAULT_AGENT_NAMES[t]}\n`;
    helpText += `\nCommandes directes :\n/marie — admin\n`;
    if (teamAgents.includes("MARKETING")) helpText += `/lucas — marketing\n`;
    if (teamAgents.includes("COMMERCIAL")) helpText += `/samir — commercial\n`;
    helpText += `\nFonctionnalités : vocal (Whisper), photo de chantier → devis PDF auto.`;
    await sendMessage(phone, helpText);
    return;
  }

  // Lookup client
  const client = await getClientByPhone(normalized);
  if (!client) {
    await sendMessage(
      phone,
      "Bienvenue sur iArtisan !\n\nJe ne te reconnais pas encore. Connecte-toi sur iartisan.io > Onboarding pour récupérer ton code."
    );
    return;
  }
  if (!["ACTIVE", "TRIAL"].includes(client.status)) {
    await sendMessage(phone, "Ton abonnement n'est pas actif. Contacte le support.");
    return;
  }

  const plan = client.plan as PlanType;
  const limitCheck = await checkMessageLimit(client.id, plan);
  if (!limitCheck.allowed) {
    await sendMessage(phone, limitCheck.blockMessage!);
    return;
  }

  // Voice → transcribe then continue as text
  if (mediaType === "audio" && mediaId) {
    const transcription = await transcribeWhatsAppAudio(mediaId);
    if (!transcription) {
      await sendMessage(phone, "Je n'ai pas réussi à transcrire ton vocal. Réessaie ou écris-moi.");
      return;
    }
    text = transcription;
    await sendMessage(
      phone,
      `(Vocal transcrit : "${transcription.substring(0, 80)}${transcription.length > 80 ? "..." : ""}")`
    );
  }

  // Image → keep dedicated devis-by-photo path (Marie owns it)
  if (mediaType === "image" && mediaId) {
    const teamAgents = PLAN_AGENTS[plan];
    const isTeam = teamAgents.length > 1;
    const prefix = isTeam ? `${AGENT_EMOJIS.ADMIN} ${DEFAULT_AGENT_NAMES.ADMIN} :\n` : "";
    await sendMessage(phone, `${prefix}J'analyse ta photo…`);
    const imageData = await downloadWhatsAppImage(mediaId);
    if (!imageData) {
      await sendMessage(phone, `${prefix}Impossible de télécharger l'image.`);
      return;
    }
    const analysis = await analyzeImageForQuote(imageData.base64, imageData.mimeType, {
      company: client.company,
      metier: client.metier,
      ville: client.ville,
      firstName: client.firstName,
      caption,
    });
    if ((analysis as any).error) {
      await sendMessage(phone, `${prefix}Erreur d'analyse : ${(analysis as any).error}.`);
      return;
    }
    const reply =
      (analysis as any).devisEstimatif ||
      (analysis as any).description ||
      "Analyse terminée mais pas de devis généré.";
    await sendMessage(phone, prefix + reply + (limitCheck.warning || ""));
    await supabase.from("agent_logs").insert({
      client_id: client.id,
      agent_type: "ADMIN",
      action: "whatsapp.photo_quote",
      tokens_used: 0,
      model_used: "pixtral",
      duration_ms: 0,
      cost_cents: 5,
      metadata: { whatsapp_phone: normalized, caption },
    });
    return;
  }

  // Text path
  if (!text) return;

  // Direct devis shortcut (kept for compatibility — also handled by tool generateDevisFromText)
  const lowerText = text.toLowerCase();
  const devisKeywords = ["devis express", "devis rapide", "génère un devis", "genere un devis"];
  const wantsImmediateDevis = devisKeywords.some((kw) => lowerText.includes(kw));
  if (wantsImmediateDevis) {
    const teamAgents = PLAN_AGENTS[plan];
    const isTeam = teamAgents.length > 1;
    const prefix = isTeam ? `${AGENT_EMOJIS.ADMIN} ${DEFAULT_AGENT_NAMES.ADMIN} :\n` : "";
    await sendMessage(phone, `${prefix}Je génère ton devis…`);
    try {
      const r = await handleDevisGeneration({
        clientId: client.id,
        clientName: `Client ${Date.now()}`,
        userPhone: normalized,
        userMessage: text,
      });
      if (r.success && r.documentUrl) {
        await sendDocument(phone, r.documentUrl, r.devisNumber || "devis.pdf", `${prefix}Devis ${r.devisNumber}`);
        await sendMessage(phone, `${prefix}${r.devisNumber} prêt ✅` + (limitCheck.warning || ""));
        return;
      }
    } catch {
      // fall through to orchestrator
    }
  }

  // Parse explicit /marie /lucas /samir
  const { command, remainingText } = parseAgentCommand(text);
  let forceAgent: AgentType | undefined;
  let processedText = text;
  if (command) {
    const teamAgents = PLAN_AGENTS[plan];
    if (!teamAgents.includes(command)) {
      const planNames: Record<PlanType, string> = {
        ESSENTIEL: "Pro (99/mois)",
        PRO: "Max (179/mois)",
        MAX: "Max",
      };
      await sendMessage(
        phone,
        `${DEFAULT_AGENT_NAMES[command]} n'est pas inclus dans ton plan actuel.\n\nPasse au plan ${planNames[plan]} pour y accéder !\niartisan.io/upgrade`
      );
      return;
    }
    forceAgent = command;
    processedText = remainingText || "Bonjour, qu'est-ce que je peux faire pour toi ?";
  }

  // Hand off to orchestrator
  try {
    await orchestrate({
      client: client as any,
      phone,
      normalizedPhone: normalized,
      text: processedText,
      forceAgent,
      sendMessage,
      sendDocument,
    });

    if (limitCheck.warning) {
      await sendMessage(phone, limitCheck.warning.trim());
    }
  } catch (err: any) {
    console.error("Orchestrator error:", err);
    await sendMessage(
      phone,
      "Désolé, j'ai eu un souci technique en traitant ta demande. Réessaie dans une minute."
    );
  }
}

// ─── GET — Meta webhook verification ────────────────────────

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({
    ok: true,
    channel: "whatsapp",
    version: "v4-orchestrator",
    status: WHATSAPP_ACCESS_TOKEN ? "configured" : "not_configured",
    features: ["orchestrator", "router-llm", "tool-use", "scheduled-tasks", "voice", "image", "devis-pdf"],
  });
}

// ─── POST — Incoming messages ────────────────────────────────

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }
  try {
    if (body.object === "whatsapp_business_account") {
      const entries = body.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          if (change.field !== "messages") continue;
          const messages = change.value?.messages || [];
          const contactName = change.value?.contacts?.[0]?.profile?.name;
          for (const message of messages) {
            const fromPhone = message.from;
            if (message.type === "text") {
              await processMessage(fromPhone, message.text?.body || "", contactName);
            } else if (message.type === "audio") {
              await processMessage(fromPhone, "", contactName, "audio", message.audio?.id);
            } else if (message.type === "image") {
              await processMessage(
                fromPhone,
                "",
                contactName,
                "image",
                message.image?.id,
                message.image?.caption
              );
            } else if (fromPhone) {
              await sendMessage(
                fromPhone,
                "Je comprends les messages texte, les vocaux et les photos. Les autres types ne sont pas encore supportés."
              );
            }
          }
        }
      }
    }
  } catch (e: any) {
    console.error("WhatsApp webhook error:", e);
  }
  return NextResponse.json({ ok: true });
}
