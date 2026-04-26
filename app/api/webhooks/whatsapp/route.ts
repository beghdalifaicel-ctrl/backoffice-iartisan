/**
 * WhatsApp Conversational Agent Webhook — v2 Multi-Agent
 *
 * Supports: text, voice (Groq Whisper), images (Mistral Pixtral devis)
 * Multi-agent routing: /marie /lucas /samir commands + auto-detect by keywords + session memory
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
import {
  AgentType,
  PlanType,
  PLAN_AGENTS,
  PLAN_QUOTAS,
  DEFAULT_AGENT_NAMES,
} from "@/lib/agents/types";
import { analyzeImageForQuote } from "@/lib/channels/vision";
import { handleDevisGeneration } from "@/lib/pdf/devis-flow";

const WHATSAPP_VERIFY_TOKEN =
  process.env.WHATSAPP_VERIFY_TOKEN || "iartisan-whatsapp-verify";
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Agent routing config ─────────────────────────────────────

const AGENT_COMMANDS: Record<string, AgentType> = {
  "/marie": "ADMIN",
  "/lucas": "MARKETING",
  "/samir": "COMMERCIAL",
};

const AGENT_KEYWORDS: Record<AgentType, string[]> = {
  ADMIN: [
    "devis", "facture", "relance", "email", "courrier", "rdv", "planning",
    "rendez-vous", "agenda", "rappel", "administratif", "comptabilite",
    "paiement", "recu", "avoir", "bon de commande", "resume", "recap",
  ],
  MARKETING: [
    "google", "avis", "seo", "reseaux", "post", "instagram", "facebook",
    "fiche google", "visibilite", "site web", "blog", "photo", "video",
    "temoignage", "reputation", "etoiles", "commentaire", "pub",
    "publicite", "annonce", "campagne",
  ],
  COMMERCIAL: [
    "prospect", "lead", "client potentiel", "appel d'offres", "marche public",
    "impaye", "recouvrement", "pipeline", "closing", "b2b", "architecte",
    "sous-traitance", "entreprise generale", "annuaire", "habitatpresto",
    "marge", "fournisseur", "prix fournisseur", "negociation",
  ],
};

// ─── WhatsApp send helpers (Meta Cloud API only) ──────────────

async function sendMessage(toPhone: string, text: string) {
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.warn("WhatsApp Cloud API not configured");
    return;
  }

  const parts =
    text.length > 4000 ? text.match(/[\s\S]{1,4000}/g) || [text] : [text];

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

async function sendDocument(
  toPhone: string,
  documentUrl: string,
  filename: string,
  caption?: string
) {
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.warn("WhatsApp Cloud API not configured");
    return;
  }

  const payload: any = {
    messaging_product: "whatsapp",
    to: toPhone,
    type: "document",
    document: { link: documentUrl, filename },
  };
  if (caption) payload.document.caption = caption;

  await fetch(
    `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
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

async function linkWhatsAppAccount(
  phone: string,
  clientId: string,
  displayName?: string
) {
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

// ─── Agent config from Supabase ──────────────────────────────

async function getAgentConfig(clientId: string, agentType: AgentType) {
  const { data } = await supabase
    .from("agent_configs")
    .select("display_name, instructions, personality")
    .eq("client_id", clientId)
    .eq("agent_type", agentType)
    .single();

  return data;
}

async function getAgentDisplayName(
  clientId: string,
  agentType: AgentType
): Promise<string> {
  const config = await getAgentConfig(clientId, agentType);
  return config?.display_name || DEFAULT_AGENT_NAMES[agentType];
}

// ─── Session management (active agent per phone) ─────────────

async function getActiveAgent(
  phone: string,
  clientId: string
): Promise<AgentType> {
  const { data } = await supabase
    .from("whatsapp_sessions")
    .select("active_agent")
    .eq("phone", phone)
    .eq("client_id", clientId)
    .single();

  return (data?.active_agent as AgentType) || "ADMIN";
}

async function setActiveAgent(
  phone: string,
  clientId: string,
  agentType: AgentType
) {
  await supabase.from("whatsapp_sessions").upsert(
    {
      phone,
      client_id: clientId,
      active_agent: agentType,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "phone" }
  );
}

// ─── Chat history ─────────────────────────────────────────────

async function getChatHistory(
  clientId: string,
  phone: string,
  agentType: AgentType,
  limit: number = 10
) {
  const { data } = await supabase
    .from("chat_history")
    .select("role, content")
    .eq("client_id", clientId)
    .eq("phone", phone)
    .eq("agent_type", agentType)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data || []).reverse();
}

async function saveChatMessage(
  clientId: string,
  phone: string,
  agentType: AgentType,
  role: "user" | "assistant",
  content: string
) {
  await supabase.from("chat_history").insert({
    client_id: clientId,
    channel: "whatsapp",
    phone,
    agent_type: agentType,
    role,
    content: content.substring(0, 5000),
  });
}

// ─── Agent detection ──────────────────────────────────────────

function parseAgentCommand(text: string): {
  command: AgentType | null;
  remainingText: string;
} {
  const trimmed = text.trim().toLowerCase();

  for (const [cmd, agent] of Object.entries(AGENT_COMMANDS)) {
    if (trimmed === cmd || trimmed.startsWith(cmd + " ")) {
      const remaining = text.trim().substring(cmd.length).trim();
      return { command: agent, remainingText: remaining };
    }
  }

  return { command: null, remainingText: text };
}

function detectAgentFromMessage(text: string): AgentType | null {
  const lower = text.toLowerCase();
  const scores: Record<AgentType, number> = { ADMIN: 0, MARKETING: 0, COMMERCIAL: 0 };

  for (const [agent, keywords] of Object.entries(AGENT_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        scores[agent as AgentType] += kw.includes(" ") ? 2 : 1; // multi-word = stronger signal
      }
    }
  }

  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) return null;

  const winner = (Object.entries(scores) as [AgentType, number][]).find(
    ([, s]) => s === maxScore
  );
  return winner ? winner[0] : null;
}

// ─── Build system prompt from agent config ────────────────────

function buildSystemPrompt(
  client: any,
  agentType: AgentType,
  agentName: string,
  agentConfig: any
): string {
  const instructions = agentConfig?.instructions || "";
  const personality = agentConfig?.personality || {};
  const tutoiement = personality.tutoiement !== false;
  const tone = personality.tone || "professionnel";

  const roleLabels: Record<AgentType, string> = {
    ADMIN: "secretaire / assistante administrative",
    MARKETING: "responsable marketing digital",
    COMMERCIAL: "responsable commercial / apporteur d'affaires",
  };

  let prompt = `Tu es ${agentName}, ${roleLabels[agentType]} de l'entreprise "${client.company}" (${client.metier} a ${client.ville}).

IMPORTANT : Tu t'adresses TOUJOURS a ${client.firstName || "ton patron"} (l'artisan, le dirigeant). C'est LUI ton interlocuteur, ton patron. Tu es son bras droit.
${tutoiement ? "Tu TUTOIES toujours ton patron. Tu es chaleureuse, directe, comme une collegue de confiance." : "Tu vouvoies ton interlocuteur."}
Quand tu rediges un message pour un CLIENT FINAL (devis, relance, email), tu VOUVOIES TOUJOURS le client final.
Tu parles toujours en francais sauf si ton patron te parle dans une autre langue.

STYLE :
- Messages concis et clairs (max 3-4 paragraphes)
- Pas de Markdown (pas de ** ou ## ou -)
- Toujours proposer une action concrete
- Ton ${tone}
- Utilise des emojis avec parcimonie
`;

  if (instructions) {
    prompt += `\nINSTRUCTIONS SPECIFIQUES :\n${instructions}\n`;
  }

  if (
    personality.restrictions &&
    personality.restrictions.length > 0
  ) {
    prompt += `\nRESTRICTIONS :\n${personality.restrictions
      .map((r: string) => `- ${r}`)
      .join("\n")}\n`;
  }

  return prompt;
}

// ─── Message limits ────────────────────────────────────────

async function checkMessageLimit(
  clientId: string,
  plan: PlanType
): Promise<{
  allowed: boolean;
  warning?: string;
  blockMessage?: string;
}> {
  const monthlyLimit = PLAN_QUOTAS[plan].messages;
  if (monthlyLimit === -1) return { allowed: true };

  const now = new Date();
  const periodStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  ).toISOString();
  const periodEnd = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59
  ).toISOString();

  const { data, error } = await supabase.rpc("check_and_increment_messages", {
    p_client_id: clientId,
    p_channel: "whatsapp",
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_limit: monthlyLimit,
  });

  if (error) {
    console.error("Message limit check error:", error);
    return { allowed: true };
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

async function transcribeWhatsAppAudio(
  mediaId: string
): Promise<string | null> {
  if (!WHATSAPP_ACCESS_TOKEN) return null;

  const mediaRes = await fetch(
    `https://graph.facebook.com/v18.0/${mediaId}`,
    { headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` } }
  );
  const mediaData = await mediaRes.json();
  if (!mediaData.url) throw new Error("Failed to get WhatsApp media URL");

  const audioRes = await fetch(mediaData.url, {
    headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
  });
  const audioBuffer = await audioRes.arrayBuffer();
  const mimeType = mediaData.mime_type || "audio/ogg";

  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");

  const ext = mimeType.includes("ogg")
    ? "ogg"
    : mimeType.includes("mp4")
      ? "m4a"
      : "ogg";

  const formData = new FormData();
  formData.append(
    "file",
    new Blob([audioBuffer], { type: "audio/ogg" }),
    `voice.${ext}`
  );
  formData.append("model", "whisper-large-v3-turbo");
  formData.append("language", "fr");
  formData.append("response_format", "text");

  const transcriptRes = await fetch(
    "https://api.groq.com/openai/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
      body: formData,
    }
  );

  if (!transcriptRes.ok) {
    console.error(
      "Groq WhatsApp transcription failed:",
      await transcriptRes.text()
    );
    return null;
  }

  const transcription = await transcriptRes.text();
  return transcription.trim() || null;
}

// ─── Image download from WhatsApp ──────────────────────────

async function downloadWhatsAppImage(
  mediaId: string
): Promise<{ base64: string; mimeType: string } | null> {
  if (!WHATSAPP_ACCESS_TOKEN) return null;

  const mediaRes = await fetch(
    `https://graph.facebook.com/v18.0/${mediaId}`,
    { headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` } }
  );
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
      await sendMessage(
        phone,
        "Ce code ne correspond a aucun compte. Verifiez et reessayez."
      );
      return;
    }

    const agentName = await getAgentDisplayName(clientId, "ADMIN");
    await sendMessage(
      phone,
      `Compte lie avec succes !\n\nBonjour ${client.firstName || displayName || ""}, je suis ${agentName}, votre assistante IA pour ${client.company}.\n\nVous pouvez me demander :\n- "Resume mes emails"\n- "Fais un devis pour..."\n- "Relance le client X"\n- Envoyez une PHOTO de chantier pour un devis automatique\n\nCommandes agents :\n/marie — Admin & secretariat\n/lucas — Marketing digital\n/samir — Commercial & prospection\n\nC'est parti !`
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

    const agents = PLAN_AGENTS[client.plan as PlanType] || ["ADMIN"];
    const activeAgent = await getActiveAgent(normalized, client.id);
    const activeName = await getAgentDisplayName(client.id, activeAgent);

    let helpText = `Agent actif : ${activeName}\n\n`;
    helpText += `Commandes :\n`;
    helpText += `/marie — Admin (devis, factures, emails, planning)\n`;

    if (agents.includes("MARKETING")) {
      helpText += `/lucas — Marketing (Google, avis, SEO, reseaux)\n`;
    }
    if (agents.includes("COMMERCIAL")) {
      helpText += `/samir — Commercial (prospects, leads, relances)\n`;
    }

    helpText += `\nVocal : envoyez un message vocal, il sera transcrit\n`;
    helpText += `Photo : envoyez une photo de chantier pour un devis\n`;
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
    await sendMessage(
      phone,
      "Votre abonnement n'est pas actif. Contactez le support."
    );
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
        await sendMessage(
          phone,
          "Je n'ai pas reussi a transcrire votre vocal. Reessayez ou envoyez un message texte."
        );
        return;
      }
      text = transcription;
      await sendMessage(
        phone,
        `(Vocal transcrit : "${transcription.substring(0, 80)}${transcription.length > 80 ? "..." : ""}")`
      );
    } catch (err: any) {
      console.error("WhatsApp voice transcription error:", err);
      await sendMessage(
        phone,
        "Erreur de transcription du vocal. Envoyez un message texte."
      );
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
        await sendMessage(
          phone,
          "Impossible de telecharger l'image. Reessayez."
        );
        return;
      }

      const analysis = await analyzeImageForQuote(
        imageData.base64,
        imageData.mimeType,
        {
          company: client.company,
          metier: client.metier,
          ville: client.ville,
          firstName: client.firstName,
          caption,
        }
      );

      if (analysis.error) {
        await sendMessage(
          phone,
          `Erreur d'analyse : ${analysis.error}. Reessayez.`
        );
        return;
      }

      const response =
        analysis.devisEstimatif ||
        analysis.description ||
        "Analyse terminee mais aucun devis n'a pu etre genere.";
      await sendMessage(phone, response + (limitCheck.warning || ""));

      await supabase.from("agent_logs").insert({
        client_id: client.id,
        agent_type: "ADMIN",
        action: "whatsapp.photo_quote",
        tokens_used: 0,
        model_used: "pixtral-large-latest",
        duration_ms: 0,
        cost_cents: 5,
        metadata: { whatsapp_phone: normalized, caption },
      });
      return;
    } catch (err: any) {
      console.error("WhatsApp image analysis error:", err);
      await sendMessage(
        phone,
        "Erreur lors de l'analyse de l'image. Reessayez."
      );
      return;
    }
  }

  // ── Normal text message ──
  if (!text) return;

  // ── 1) Parse agent command (/marie, /lucas, /samir) ──
  const { command: agentCommand, remainingText } = parseAgentCommand(text);
  let agentType: AgentType;
  let messageToProcess = text;

  if (agentCommand) {
    // Check plan access
    if (!PLAN_AGENTS[plan].includes(agentCommand)) {
      const agentName = DEFAULT_AGENT_NAMES[agentCommand];
      const planNames: Record<PlanType, string> = {
        ESSENTIEL: "Pro (99/mois)",
        PRO: "Max (179/mois)",
        MAX: "Max",
      };
      await sendMessage(
        phone,
        `${agentName} n'est pas disponible avec votre plan actuel.\n\nPassez au plan ${planNames[plan]} pour y acceder !\niartisan.io/upgrade`
      );
      return;
    }

    agentType = agentCommand;
    await setActiveAgent(normalized, client.id, agentType);

    if (!remainingText) {
      // Just switching agent, no message
      const agentName = await getAgentDisplayName(client.id, agentType);
      await sendMessage(
        phone,
        `OK, tu parles maintenant a ${agentName}. Qu'est-ce que je peux faire pour toi ?`
      );
      return;
    }
    messageToProcess = remainingText;
  } else {
    // ── 2) Auto-detect agent by keywords ──
    const detected = detectAgentFromMessage(text);
    if (detected && PLAN_AGENTS[plan].includes(detected)) {
      agentType = detected;
      await setActiveAgent(normalized, client.id, agentType);
    } else {
      // ── 3) Fall back to session agent ──
      agentType = await getActiveAgent(normalized, client.id);
    }
  }

  // ── Check for devis request (always handled by ADMIN) ──
  const lowerText = messageToProcess.toLowerCase();
  const devisKeywords = [
    "devis",
    "quote",
    "estimation",
    "tarif",
    "prix",
    "chiffrage",
  ];
  const isDevisRequest = devisKeywords.some((kw) => lowerText.includes(kw));

  if (isDevisRequest) {
    try {
      await sendMessage(phone, "Je genere votre devis...");

      const devisResult = await handleDevisGeneration({
        clientId: client.id,
        clientName: `Client ${new Date().getTime()}`,
        clientAddress: undefined,
        clientEmail: undefined,
        userPhone: normalized,
        userMessage: messageToProcess,
      });

      if (devisResult.success && devisResult.documentUrl) {
        await sendDocument(
          phone,
          devisResult.documentUrl,
          devisResult.devisNumber || "devis.pdf",
          `Devis ${devisResult.devisNumber}\n\nVoici votre devis. Telechargez-le, imprimez-le ou dites-moi si vous voulez des modifications.`
        );

        const successMsg =
          `${devisResult.devisNumber} cree avec succes !\n\nLe PDF est envoye. Dites-moi si vous avez des modifications.` +
          (limitCheck.warning || "");
        await sendMessage(phone, successMsg);

        await supabase.from("agent_logs").insert({
          client_id: client.id,
          agent_type: "ADMIN",
          action: "whatsapp.devis_generated",
          tokens_used: 0,
          model_used: "pdf-lib",
          duration_ms: 0,
          cost_cents: 0,
          metadata: {
            whatsapp_phone: normalized,
            devis_number: devisResult.devisNumber,
            document_url: devisResult.documentUrl,
          },
        });
        return;
      } else {
        await sendMessage(
          phone,
          `Impossible de generer le PDF (${devisResult.error}). Je vais vous aider autrement...`
        );
        // Fall through to LLM
      }
    } catch (err: any) {
      console.error("WhatsApp devis generation error:", err);
      await sendMessage(
        phone,
        "Erreur lors de la generation du devis. Reessayez ou decrivez autrement votre demande."
      );
      return;
    }
  }

  // ── Build prompt from agent config ──
  const agentConfig = await getAgentConfig(client.id, agentType);
  const agentName =
    agentConfig?.display_name || DEFAULT_AGENT_NAMES[agentType];
  const systemPrompt = buildSystemPrompt(
    client,
    agentType,
    agentName,
    agentConfig
  );

  // ── Get chat history for context ──
  const history = await getChatHistory(client.id, normalized, agentType, 10);
  let userPrompt = messageToProcess;

  if (history.length > 0) {
    const historyText = history
      .map(
        (m: any) =>
          `${m.role === "user" ? client.firstName || "Patron" : agentName}: ${m.content}`
      )
      .join("\n");
    userPrompt = `[Historique recent]\n${historyText}\n\n[Message actuel]\n${messageToProcess}`;
  }

  // ── Save user message ──
  await saveChatMessage(
    client.id,
    normalized,
    agentType,
    "user",
    messageToProcess
  );

  // ── Call LLM ──
  const response = await callLLM({
    taskType: "email.reply",
    systemPrompt,
    userPrompt,
    maxTokens: 1024,
    temperature: 0.5,
  });

  const reply =
    (response.content ||
      "Desole, je n'ai pas pu traiter votre demande. Reessayez.") +
    (limitCheck.warning || "");
  await sendMessage(phone, reply);

  // ── Save assistant response ──
  await saveChatMessage(
    client.id,
    normalized,
    agentType,
    "assistant",
    response.content || ""
  );

  // ── Log ──
  await supabase.from("agent_logs").insert({
    client_id: client.id,
    agent_type: agentType,
    action: "whatsapp.chat",
    tokens_used: response.tokensUsed.total,
    model_used: response.model,
    duration_ms: response.durationMs,
    cost_cents: Math.ceil(
      (response.tokensUsed.total / 1000) * 0.0027 * 100
    ),
    metadata: {
      whatsapp_phone: normalized,
      user_message: messageToProcess.substring(0, 200),
      agent_used: agentType,
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
    features: ["multi-agent", "voice", "image", "devis-pdf"],
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
              await processMessage(
                fromPhone,
                message.text?.body || "",
                contactName
              );
            } else if (message.type === "audio") {
              await processMessage(
                fromPhone,
                "",
                contactName,
                "audio",
                message.audio?.id
              );
            } else if (message.type === "image") {
              await processMessage(
                fromPhone,
                "",
                contactName,
                "image",
                message.image?.id,
                message.image?.caption
              );
            } else {
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
