/**
 * WhatsApp Conversational Agent Webhook
 *
 * Mirrors /api/webhooks/telegram — direct LLM chat with company context.
 * Supports both Meta Cloud API and Ringover as message sources.
 *
 * Setup Meta:
 * 1. Create WhatsApp Business App on Meta Business Suite
 * 2. Set webhook URL: https://app.iartisan.io/api/webhooks/whatsapp
 * 3. Subscribe to "messages" field
 * 4. Add WHATSAPP_VERIFY_TOKEN, WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID to env
 *
 * Setup Ringover:
 * - Create webhook in Ringover dashboard → URL: https://app.iartisan.io/api/webhooks/whatsapp
 * - Event types: whatsapp_message_received
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callLLM } from "@/lib/agents/llm";
import { AgentType, PlanType, PLAN_AGENTS, DEFAULT_AGENT_NAMES } from "@/lib/agents/types";

const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "iartisan-whatsapp-verify";
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const RINGOVER_API_KEY = process.env.RINGOVER_API_KEY;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── WhatsApp send helpers ──────────────────────────────────

async function sendMessage(toPhone: string, text: string, provider: "meta" | "ringover" = "meta") {
  if (provider === "ringover" && RINGOVER_API_KEY) {
    await fetch("https://public-api.ringover.com/v2/whatsapp/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RINGOVER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to_number: toPhone, body: text }),
    });
    return;
  }

  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.warn("WhatsApp Cloud API not configured");
    return;
  }

  await fetch(
    `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toPhone,
        type: "text",
        text: { body: text },
      }),
    }
  );
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

// ─── Agent config & prompt ──────────────────────────────────

async function getAgentDisplayName(clientId: string, agentType: AgentType): Promise<string> {
  const { data } = await supabase
    .from("agent_configs")
    .select("display_name")
    .eq("client_id", clientId)
    .eq("agent_type", agentType)
    .single();

  return data?.display_name || DEFAULT_AGENT_NAMES[agentType];
}

function buildChatPrompt(client: any, agentName: string): string {
  return `Tu es ${agentName}, l'assistant IA de l'entreprise "${client.company}" (${client.metier} à ${client.ville}).
Tu parles à ${client.firstName || "votre client"} via WhatsApp.

IMPORTANT — Accords de genre : Adapte TOUJOURS les accords grammaticaux au prénom de ton interlocuteur.

Tu es professionnel·le, concis·e et chaleureux·se. Tu parles toujours en français.
Tu peux aider avec :
- Lire et résumer les emails reçus
- Rédiger et envoyer des réponses email
- Créer des devis et des factures
- Relancer les clients en attente
- Donner un résumé de l'activité récente

Si on te demande quelque chose que tu ne peux pas faire, dis-le honnêtement et propose une alternative.
Réponds de manière concise (max 3-4 paragraphes). Utilise des emojis avec parcimonie.
Ne réponds JAMAIS en Markdown. Utilise du texte brut uniquement (pas de HTML, pas de *bold*).`;
}

// ─── Process a single message ───────────────────────────────

async function processMessage(
  phone: string,
  text: string,
  displayName: string | undefined,
  provider: "meta" | "ringover"
) {
  const normalized = phone.replace(/[^0-9]/g, "");
  const trimmed = text.trim();

  // ── Link command (from onboarding) ──
  if (trimmed.startsWith("link_") || trimmed.startsWith("Link_")) {
    const clientId = trimmed.replace(/^[Ll]ink_/, "");
    const client = await linkWhatsAppAccount(phone, clientId, displayName);

    if (!client) {
      await sendMessage(phone, "❌ Ce code ne correspond à aucun compte. Vérifiez et réessayez.", provider);
      return;
    }

    const agentName = await getAgentDisplayName(clientId, "ADMIN");

    await sendMessage(
      phone,
      `✅ Compte lié avec succès !\n\n👋 Bonjour ${client.firstName || displayName || ""}, je suis ${agentName}, votre assistant·e IA pour ${client.company}.\n\nVous pouvez me demander :\n• "Résume mes emails"\n• "Rédige un devis pour..."\n• "Relance le client X"\n• "Aide"\n\nC'est parti ! 💪`,
      provider
    );
    return;
  }

  // ── Aide / Help ──
  const lower = trimmed.toLowerCase();
  if (["aide", "help", "menu", "bonjour", "hello"].includes(lower)) {
    const client = await getClientByPhone(normalized);
    if (!client) {
      await sendMessage(
        phone,
        "👋 Bienvenue sur iArtisan !\n\nPour connecter vos agents IA, envoyez votre code de liaison.\nVous le trouverez dans votre espace client sur iartisan.io → Onboarding → Étape Canaux.\n\nExemple : link_votre-client-id",
        provider
      );
      return;
    }

    const agentName = await getAgentDisplayName(client.id, "ADMIN");
    const agents = PLAN_AGENTS[client.plan as PlanType] || ["ADMIN"];

    let helpText = `🤖 ${agentName} — Assistant ${client.company}\n\nVoici ce que je peux faire :\n\n`;
    helpText += `📧 Emails : "Résume mes emails", "Réponds à [email]"\n`;
    helpText += `📝 Devis : "Fais un devis pour [description]"\n`;
    helpText += `🧾 Factures : "Facture pour [client]"\n`;
    helpText += `🔔 Relances : "Relance [client]"\n`;
    helpText += `📊 Résumé : "Résumé de la semaine"\n`;

    if (agents.includes("MARKETING")) {
      helpText += `\n📢 Marketing : "Poste sur Google", "Réponds aux avis"\n`;
    }
    if (agents.includes("COMMERCIAL")) {
      helpText += `\n💼 Commercial : "Trouve des prospects à [ville]", "Relance les impayés"\n`;
    }

    helpText += `\nÉcrivez simplement ce dont vous avez besoin ! 💬`;

    await sendMessage(phone, helpText, provider);
    return;
  }

  // ── Normal message → LLM ──
  const client = await getClientByPhone(normalized);

  if (!client) {
    await sendMessage(
      phone,
      "👋 Bonjour !\n\nJe ne vous reconnais pas encore. Pour commencer :\n1. Connectez-vous sur votre espace client iArtisan\n2. Allez dans l'onboarding\n3. Cliquez sur le lien WhatsApp\n\nÀ tout de suite ! 🚀",
      provider
    );
    return;
  }

  if (!["ACTIVE", "TRIAL"].includes(client.status)) {
    await sendMessage(phone, "⚠️ Votre abonnement n'est pas actif. Contactez le support pour réactiver votre compte.", provider);
    return;
  }

  // Determine agent type
  let agentType: AgentType = "ADMIN";
  const lowerText = trimmed.toLowerCase();

  if (
    lowerText.includes("prospect") ||
    lowerText.includes("lead") ||
    lowerText.includes("impayé") ||
    lowerText.includes("recouvrement")
  ) {
    const plan = client.plan as PlanType;
    if (PLAN_AGENTS[plan].includes("COMMERCIAL")) agentType = "COMMERCIAL";
  } else if (
    lowerText.includes("google") ||
    lowerText.includes("avis") ||
    lowerText.includes("seo") ||
    lowerText.includes("réseaux") ||
    lowerText.includes("post")
  ) {
    const plan = client.plan as PlanType;
    if (PLAN_AGENTS[plan].includes("MARKETING")) agentType = "MARKETING";
  }

  const agentName = await getAgentDisplayName(client.id, agentType);
  const systemPrompt = buildChatPrompt(client, agentName);

  const response = await callLLM({
    taskType: "email.reply",
    systemPrompt,
    userPrompt: trimmed,
    maxTokens: 1024,
    temperature: 0.5,
  });

  const reply = response.content || "Désolé, je n'ai pas pu traiter votre demande. Réessayez.";

  // WhatsApp message limit is ~65536 chars but keep it reasonable
  if (reply.length > 4000) {
    const parts = reply.match(/[\s\S]{1,4000}/g) || [reply];
    for (const part of parts) {
      await sendMessage(phone, part, provider);
    }
  } else {
    await sendMessage(phone, reply, provider);
  }

  // Log the interaction
  await supabase.from("agent_logs").insert({
    client_id: client.id,
    agent_type: agentType,
    action: "whatsapp.chat",
    tokens_used: response.tokensUsed.total,
    model_used: response.model,
    duration_ms: response.durationMs,
    cost_cents: Math.ceil((response.tokensUsed.total / 1000) * 0.0027 * 100),
    metadata: {
      whatsapp_phone: normalized,
      user_message: trimmed.substring(0, 200),
    },
  });
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
    endpoint: "conversational",
    status: WHATSAPP_ACCESS_TOKEN ? "configured" : "not_configured",
  });
}

// ─── POST — Incoming messages ───────────────────────────────

export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    // Detect source: Ringover or Meta Cloud API
    if (body.event_type || body.event) {
      // ── Ringover ──
      const eventType = body.event_type || body.event;
      if (!["whatsapp_message_received", "WHATSAPP_MESSAGE_RECEIVED"].includes(eventType)) {
        return NextResponse.json({ ok: true, skipped: true });
      }

      const data = body.data || body;
      const fromPhone = data.from_number || data.from || data.sender;
      const messageText = data.body || data.message || data.text || data.content;
      const contactName = data.contact_name || data.sender_name;

      if (fromPhone && messageText) {
        await processMessage(fromPhone, messageText, contactName, "ringover");
      }
    } else if (body.object === "whatsapp_business_account") {
      // ── Meta Cloud API ──
      const entries = body.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          if (change.field !== "messages") continue;

          const messages = change.value?.messages || [];
          for (const message of messages) {
            if (message.type !== "text") continue;

            const fromPhone = message.from;
            const messageText = message.text?.body;
            const contactName = change.value?.contacts?.[0]?.profile?.name;

            if (fromPhone && messageText) {
              await processMessage(fromPhone, messageText, contactName, "meta");
            }
          }
        }
      }
    }
  } catch (error: any) {
    console.error("WhatsApp webhook error:", error);
  }

  // Always return 200
  return NextResponse.json({ ok: true });
}
