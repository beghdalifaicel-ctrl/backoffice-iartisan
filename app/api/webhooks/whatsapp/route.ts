/**
 * WhatsApp Conversational Agent Webhook
 *
 * Supports: text, voice (Groq Whisper), images (Mistral Pixtral devis)
 * Provider: Meta Cloud API only (no Ringover — Ringover = Easydentist only)
 *
 * Setup:
 * 1. Create WhatsApp Business App on Meta Business Suite
 * 2. Set webhook URL: https://app.iartisan.io/api/webhooks/whatsapp
 * 3. Subscribe to "messages" field
 * 4. Add WHATSAPP_VERIFY_TOKEN, WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID to env
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callLLM } from "@/lib/agents/llm";
import { AgentType, PlanType, PLAN_AGENTS, PLAN_QUOTAS, DEFAULT_AGENT_NAMES } from "@/lib/agents/types";
import { analyzeImageForQuote, downloadImageAsBase64 } from "@/lib/channels/vision";

const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "iartisan-whatsapp-verify";
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── WhatsApp send helper (Meta Cloud API only) ────────────

async function sendMessage(toPhone: string, text: string) {
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.warn("WhatsApp Cloud API not configured");
    return;
  }

  // WhatsApp max message is ~65536, but keep it reasonable
  const parts = text.length > 4000 ? text.match(/[\s\S]{1,4000}/g) || [text] : [text];

  for (const part of parts) {
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
          text: { body: part },
        }),
      }
    );
  }
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

// ─── Agent config ──────────────────────────────────────────

async function getAgentDisplayName(clientId: string, agentType: AgentType): Promise<string> {
  const { data } = await supabase
    .from("agent_configs")
    .select("display_name")
    .eq("client_id", clientId)
    .eq("agent_type", agentType)
    .single();

  return data?.display_name || DEFAULT_AGENT_NAMES[agentType];
}

// ─── Message limits ────────────────────────────────────────

async function checkMessageLimit(
  clientId: string,
  plan: PlanType
): Promise<{ allowed: boolean; warning?: string; blockMessage?: string }> {
  const monthlyLimit = PLAN_QUOTAS[plan].messages;
  if (monthlyLimit === -1) return { allowed: true }; // Unlimited

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

  if (error) {
    console.error("Message limit check error:", error);
    return { allowed: true }; // Fail open
  }

  const usage = data?.messages_used || 0;

  if (usage > monthlyLimit) {
    const planNames: Record<PlanType, string> = {
      ESSENTIEL: "Pro (99/mois)",
      PRO: "Max (179/mois)",
      MAX: "Max",
    };
    return {
      allowed: false,
      blockMessage: `Vous avez atteint votre limite de ${monthlyLimit} messages ce mois-ci.\n\nPassez au plan ${planNames[plan]} pour continuer a utiliser vos agents !\n\niartisan.io/upgrade`,
    };
  }

  if (usage >= Math.floor(monthlyLimit * 0.8)) {
    const remaining = monthlyLimit - usage;
    return {
      allowed: true,
      warning: `\n\n(Il vous reste ${remaining} message${remaining > 1 ? "s" : ""} ce mois — ${usage}/${monthlyLimit})`,
    };
  }

  return { allowed: true };
}

// ─── Voice transcription (Groq Whisper) ────────────────────

async function transcribeWhatsAppAudio(mediaId: string): Promise<string | null> {
  if (!WHATSAPP_ACCESS_TOKEN) return null;

  // Step 1: Get media URL from WhatsApp
  const mediaRes = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
  });
  const mediaData = await mediaRes.json();
  if (!mediaData.url) throw new Error("Failed to get WhatsApp media URL");

  // Step 2: Download the audio
  const audioRes = await fetch(mediaData.url, {
    headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
  });
  const audioBuffer = await audioRes.arrayBuffer();
  const mimeType = mediaData.mime_type || "audio/ogg";

  // Step 3: Transcribe via Groq Whisper
  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");

  const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "m4a" : "ogg";

  const formData = new FormData();
  formData.append("file", new Blob([audioBuffer], { type: "audio/ogg" }), `voice.${ext}`);
  formData.append("model", "whisper-large-v3-turbo");
  formData.append("language", "fr");
  formData.append("response_format", "text");

  const transcriptRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
    body: formData,
  });

  if (!transcriptRes.ok) {
    console.error("Groq WhatsApp transcription failed:", await transcriptRes.text());
    return null;
  }

  const transcription = await transcriptRes.text();
  return transcription.trim() || null;
}

// ─── Image download from WhatsApp ──────────────────────────

async function downloadWhatsAppImage(mediaId: string): Promise<{ base64: string; mimeType: string } | null> {
  if (!WHATSAPP_ACCESS_TOKEN) return null;

  const mediaRes = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
  });
  const mediaData = await mediaRes.json();
  if (!mediaData.url) return null;

  const imageRes = await fetch(mediaData.url, {
    headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
  });
  const buffer = await imageRes.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const mimeType = mediaData.mime_type || "image/jpeg";

  return { base64, mimeType };
}

// ─── Chat prompt ───────────────────────────────────────────

function buildChatPrompt(client: any, agentName: string): string {
  return `Tu es ${agentName}, l'assistant IA de l'entreprise "${client.company}" (${client.metier} a ${client.ville}).
Tu parles a ${client.firstName || "votre client"} via WhatsApp.

Tu es professionnel, concis et chaleureux. Tu parles toujours en francais.
Tu peux aider avec :
- Lire et resumer les emails recus
- Rediger et envoyer des reponses email
- Creer des devis et des factures
- Relancer les clients en attente
- Donner un resume de l'activite recente

Si on te demande quelque chose que tu ne peux pas faire, dis-le honnetement et propose une alternative.
Reponds de maniere concise (max 3-4 paragraphes). Utilise des emojis avec parcimonie.
Ne reponds JAMAIS en Markdown. Utilise du texte brut uniquement.`;
}

// ─── Process a single message ───────────────────────────────

async function processMessage(
  phone: string,
  text: string,
  displayName: string | undefined,
  mediaType?: "audio" | "image",
  mediaId?: string,
  caption?: string
) {
  const normalized = phone.replace(/[^0-9]/g, "");

  // ── Link command ──
  const trimmed = (text || "").trim();
  if (trimmed.startsWith("link_") || trimmed.startsWith("Link_")) {
    const clientId = trimmed.replace(/^[Ll]ink_/, "");
    const client = await linkWhatsAppAccount(phone, clientId, displayName);

    if (!client) {
      await sendMessage(phone, "Ce code ne correspond a aucun compte. Verifiez et reessayez.");
      return;
    }

    const agentName = await getAgentDisplayName(clientId, "ADMIN");
    await sendMessage(
      phone,
      `Compte lie avec succes !\n\nBonjour ${client.firstName || displayName || ""}, je suis ${agentName}, votre assistant IA pour ${client.company}.\n\nVous pouvez me demander :\n- "Resume mes emails"\n- "Fais un devis pour..."\n- "Relance le client X"\n- Envoyez une PHOTO de chantier pour un devis automatique\n- "Aide"\n\nC'est parti !`
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
        "Bienvenue sur iArtisan !\n\nPour connecter vos agents IA, envoyez votre code de liaison.\nVous le trouverez dans votre espace client sur iartisan.io > Onboarding > Canaux.\n\nExemple : link_votre-client-id"
      );
      return;
    }

    const agentName = await getAgentDisplayName(client.id, "ADMIN");
    const agents = PLAN_AGENTS[client.plan as PlanType] || ["ADMIN"];

    let helpText = `${agentName} — Assistant ${client.company}\n\nVoici ce que je peux faire :\n\n`;
    helpText += `Emails : "Resume mes emails", "Reponds a [email]"\n`;
    helpText += `Devis : "Fais un devis pour [description]"\n`;
    helpText += `Devis photo : Envoyez une photo de chantier !\n`;
    helpText += `Factures : "Facture pour [client]"\n`;
    helpText += `Relances : "Relance [client]"\n`;
    helpText += `Resume : "Resume de la semaine"\n`;

    if (agents.includes("MARKETING")) {
      helpText += `\nMarketing : "Poste sur Google", "Reponds aux avis"\n`;
    }
    if (agents.includes("COMMERCIAL")) {
      helpText += `\nCommercial : "Trouve des prospects a [ville]", "Relance les impayes"\n`;
    }

    helpText += `\nEcrivez simplement ce dont vous avez besoin !`;
    await sendMessage(phone, helpText);
    return;
  }

  // ── Lookup client ──
  const client = await getClientByPhone(normalized);

  if (!client) {
    await sendMessage(
      phone,
      "Bonjour !\n\nJe ne vous reconnais pas encore. Pour commencer :\n1. Connectez-vous sur iartisan.io\n2. Allez dans l'onboarding\n3. Cliquez sur le lien WhatsApp\n\nA tout de suite !"
    );
    return;
  }

  if (!["ACTIVE", "TRIAL"].includes(client.status)) {
    await sendMessage(phone, "Votre abonnement n'est pas actif. Contactez le support.");
    return;
  }

  // ── Check message limit ──
  const plan = client.plan as PlanType;
  const limitCheck = await checkMessageLimit(client.id, plan);
  if (!limitCheck.allowed) {
    await sendMessage(phone, limitCheck.blockMessage!);
    return;
  }

  // ── Handle VOICE messages ──
  if (mediaType === "audio" && mediaId) {
    try {
      const transcription = await transcribeWhatsAppAudio(mediaId);
      if (!transcription) {
        await sendMessage(phone, "Je n'ai pas reussi a transcrire votre vocal. Reessayez ou envoyez un message texte.");
        return;
      }
      // Process transcribed text as a normal message
      text = transcription;
      await sendMessage(phone, `(Vocal transcrit : "${transcription.substring(0, 80)}${transcription.length > 80 ? "..." : ""}")`);
    } catch (err: any) {
      console.error("WhatsApp voice transcription error:", err);
      await sendMessage(phone, "Erreur de transcription du vocal. Envoyez un message texte.");
      return;
    }
  }

  // ── Handle IMAGE messages → Devis par photo ──
  if (mediaType === "image" && mediaId) {
    try {
      const agentName = await getAgentDisplayName(client.id, "ADMIN");
      await sendMessage(phone, `${agentName} analyse votre photo...`);

      const imageData = await downloadWhatsAppImage(mediaId);
      if (!imageData) {
        await sendMessage(phone, "Impossible de telecharger l'image. Reessayez.");
        return;
      }

      const analysis = await analyzeImageForQuote(imageData.base64, imageData.mimeType, {
        company: client.company,
        metier: client.metier,
        ville: client.ville,
        firstName: client.firstName,
        caption,
      });

      if (analysis.error) {
        await sendMessage(phone, `Erreur d'analyse : ${analysis.error}. Reessayez.`);
        return;
      }

      const response = analysis.devisEstimatif || analysis.description || "Analyse terminee mais aucun devis n'a pu etre genere.";
      const fullResponse = response + (limitCheck.warning || "");
      await sendMessage(phone, fullResponse);

      // Log
      await supabase.from("agent_logs").insert({
        client_id: client.id,
        agent_type: "ADMIN",
        action: "whatsapp.photo_quote",
        tokens_used: 0,
        model_used: "pixtral-large-latest",
        duration_ms: 0,
        cost_cents: 5, // Pixtral ~5 cents per image
        metadata: { whatsapp_phone: normalized, caption },
      });
      return;
    } catch (err: any) {
      console.error("WhatsApp image analysis error:", err);
      await sendMessage(phone, "Erreur lors de l'analyse de l'image. Reessayez.");
      return;
    }
  }

  // ── Normal text message → LLM ──
  if (!text) return;

  let agentType: AgentType = "ADMIN";
  const lowerText = text.toLowerCase();

  if (
    lowerText.includes("prospect") ||
    lowerText.includes("lead") ||
    lowerText.includes("impaye") ||
    lowerText.includes("recouvrement")
  ) {
    if (PLAN_AGENTS[plan].includes("COMMERCIAL")) agentType = "COMMERCIAL";
  } else if (
    lowerText.includes("google") ||
    lowerText.includes("avis") ||
    lowerText.includes("seo") ||
    lowerText.includes("reseaux") ||
    lowerText.includes("post")
  ) {
    if (PLAN_AGENTS[plan].includes("MARKETING")) agentType = "MARKETING";
  }

  const agentName = await getAgentDisplayName(client.id, agentType);
  const systemPrompt = buildChatPrompt(client, agentName);

  const response = await callLLM({
    taskType: "email.reply",
    systemPrompt,
    userPrompt: text,
    maxTokens: 1024,
    temperature: 0.5,
  });

  const reply = (response.content || "Desole, je n'ai pas pu traiter votre demande. Reessayez.") + (limitCheck.warning || "");
  await sendMessage(phone, reply);

  // Log
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
      user_message: text.substring(0, 200),
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
    status: WHATSAPP_ACCESS_TOKEN ? "configured" : "not_configured",
  });
}

// ─── POST — Incoming messages (Meta Cloud API) ─────────────

export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    // Meta Cloud API format only
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
              // Text message
              await processMessage(fromPhone, message.text?.body || "", contactName);
            } else if (message.type === "audio") {
              // Voice note
              await processMessage(fromPhone, "", contactName, "audio", message.audio?.id);
            } else if (message.type === "image") {
              // Photo → devis
              await processMessage(
                fromPhone,
                "",
                contactName,
                "image",
                message.image?.id,
                message.image?.caption
              );
            } else {
              // Unsupported type — inform user
              if (fromPhone) {
                await sendMessage(
                  fromPhone,
                  "Je comprends les messages texte, les vocaux et les photos. Les autres types de fichiers ne sont pas encore supportes."
                );
              }
            }
          }
        }
      }
    }
  } catch (error: any) {
    console.error("WhatsApp webhook error:", error);
  }

  return NextResponse.json({ ok: true });
}
