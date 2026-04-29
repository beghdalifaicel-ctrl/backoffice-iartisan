/**
 * WhatsApp Conversational Agent Webhook — v3 Team Chat
 *
 * Supports: text, voice (Groq Whisper), images (Mistral Pixtral devis)
 * Team chat mode: multiple agents respond in the same conversation
 * - Essentiel: Marie seule
 * - Pro: Marie + Lucas
 * - Max: Marie + Lucas + Samir
 *
 * Each agent responds with emoji+name prefix: "🟣 Marie : ..."
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

const AGENT_EMOJIS: Record<AgentType, string> = {
  ADMIN: "🟣",
  MARKETING: "🟢",
  COMMERCIAL: "🔴",
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

/**
 * Score ALL agents against the message text.
 * Returns a map of agent → score. Multi-word keywords score 2, single-word score 1.
 */
function scoreAllAgents(text: string): Record<AgentType, number> {
  const lower = text.toLowerCase();
  const scores: Record<AgentType, number> = { ADMIN: 0, MARKETING: 0, COMMERCIAL: 0 };

  for (const [agent, keywords] of Object.entries(AGENT_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        scores[agent as AgentType] += kw.includes(" ") ? 2 : 1;
      }
    }
  }

  return scores;
}

// ─── Build system prompt from agent config (team-aware) ──────

function buildSystemPrompt(
  client: any,
  agentType: AgentType,
  agentName: string,
  agentConfig: any,
  teamMembers: { type: AgentType; name: string }[]
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

Tu t'adresses a ${client.firstName || "ton patron"} (l'artisan, le dirigeant) sur WhatsApp. Tu es son bras droit.
${tutoiement ? "Tu TUTOIES toujours. Tu es directe, chaleureuse, comme une collegue de confiance." : "Tu vouvoies."}
Si tu rediges un message pour un CLIENT FINAL, tu VOUVOIES le client final.
Francais toujours sauf si ton patron parle une autre langue.

STYLE WHATSAPP — REGLES STRICTES :
- ULTRA CONCIS : 2-3 phrases MAX par message. Comme un SMS entre collegues.
- JAMAIS de pave de texte. Si tu as besoin d'expliquer plus, decoupe en etapes et demande "on continue ?"
- JAMAIS de listes a puces, pas de Markdown (pas de ** ## -)
- INTERACTIF : pose UNE question a la fin pour avancer. Ne fais pas tout d'un coup.
- Propose UNE action concrete, pas trois. Attends la reponse avant la suite.
- Ton ${tone} mais decontracte (c'est WhatsApp, pas un email)
- Emojis OK avec parcimonie (1-2 max par message)

EXEMPLES DE BON FORMAT :
"J'ai vu que Dupont n'a pas paye sa facture de mars (850 euros). Je lui envoie une relance polie ou tu preferes qu'on attende ?"
"Ta fiche Google a 3 avis sans reponse. Je m'en occupe maintenant ?"
"J'ai repere 2 appels d'offres interessants dans ta zone. Tu veux que je te fasse un resume rapide ?"

MAUVAIS FORMAT (INTERDIT) :
- Longs paragraphes explicatifs
- Listes de 5+ options
- Reponses de plus de 4 lignes

`;

  // ─── Team awareness ───
  const otherMembers = teamMembers.filter((m) => m.type !== agentType);
  if (otherMembers.length > 0) {
    const colleagueList = otherMembers
      .map((m) => `${AGENT_EMOJIS[m.type]} ${m.name} (${roleLabels[m.type]})`)
      .join(", ");
    prompt += `EQUIPE : Tu bosses avec ${colleagueList}. Chacun repond sur son domaine.
Sois encore PLUS court quand tu reponds en equipe (1-2 phrases). Pas de repetition.

`;
  }

  // ─── Agent scope: what this agent can and cannot do ───
  const scopeDescriptions: Record<AgentType, string> = {
    ADMIN: `TON PERIMETRE (ce que tu sais faire) :
- Lire et repondre aux emails
- Generer des devis et factures
- Relancer les clients (paiements, suivi)
- Faire un rapport hebdomadaire
- Resume d'emails

CE QUI N'EST PAS TON ROLE :
- Marketing, SEO, reseaux sociaux, fiche Google → c'est le domaine de ${otherMembers.find((m) => m.type === "MARKETING")?.name || "Lucas"}
- Prospection, qualification de leads, annuaires → c'est le domaine de ${otherMembers.find((m) => m.type === "COMMERCIAL")?.name || "Samir"}`,

    MARKETING: `TON PERIMETRE (ce que tu sais faire) :
- Optimiser la fiche Google Business Profile
- Publier des posts sur Google, reseaux sociaux
- Repondre aux avis clients en ligne
- Audit SEO local
- Mise a jour du site web

CE QUI N'EST PAS TON ROLE :
- Devis, factures, emails clients, relances de paiement → c'est le domaine de ${otherMembers.find((m) => m.type === "ADMIN")?.name || "Marie"}
- Prospection, qualification de leads, annuaires → c'est le domaine de ${otherMembers.find((m) => m.type === "COMMERCIAL")?.name || "Samir"}
Tu ne generes JAMAIS de devis, facture ou document administratif.`,

    COMMERCIAL: `TON PERIMETRE (ce que tu sais faire) :
- Prospecter et trouver de nouveaux clients
- Qualifier les leads entrants
- Repondre aux demandes de prospects
- Envoyer des emails de prospection
- Inscrire l'entreprise sur les annuaires
- Relancer les impayes

CE QUI N'EST PAS TON ROLE :
- Gestion des emails courants, devis detailles, factures → c'est le domaine de ${otherMembers.find((m) => m.type === "ADMIN")?.name || "Marie"}
- Marketing, SEO, fiche Google, reseaux sociaux → c'est le domaine de ${otherMembers.find((m) => m.type === "MARKETING")?.name || "Lucas"}`,
  };

  prompt += `\n${scopeDescriptions[agentType]}\n\nHors perimetre → "Ca c'est pour [collegue], il/elle gere !"\n`;

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

// ─── Call a single agent and send its prefixed response ─────

async function callAgentAndRespond(
  phone: string,
  normalized: string,
  client: any,
  agentType: AgentType,
  messageToProcess: string,
  teamMembers: { type: AgentType; name: string }[],
  usePrefix: boolean,
  warningText: string
): Promise<{ agentType: AgentType; content: string; model: string; tokensTotal: number; durationMs: number } | null> {
  const agentConfig = await getAgentConfig(client.id, agentType);
  const agentName = agentConfig?.display_name || DEFAULT_AGENT_NAMES[agentType];
  const systemPrompt = buildSystemPrompt(client, agentType, agentName, agentConfig, teamMembers);

  // Get chat history for context
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

  // Save user message
  await saveChatMessage(client.id, normalized, agentType, "user", messageToProcess);

  // Call LLM
  const response = await callLLM({
    taskType: "email.reply",
    systemPrompt,
    userPrompt,
    maxTokens: 300,
    temperature: 0.6,
  });

  const rawContent = response.content || "Desole, je n'ai pas pu traiter ta demande.";

  // Build prefixed message
  const prefix = usePrefix ? `${AGENT_EMOJIS[agentType]} ${agentName} :\n` : "";
  const fullReply = prefix + rawContent + warningText;

  // Send via WhatsApp
  await sendMessage(phone, fullReply);

  // Save assistant response
  await saveChatMessage(client.id, normalized, agentType, "assistant", rawContent);

  return {
    agentType,
    content: rawContent,
    model: response.model,
    tokensTotal: response.tokensUsed.total,
    durationMs: response.durationMs,
  };
}

// ─── Process a single message (team chat mode) ────────────────

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

    // Show team welcome based on plan
    const plan = "ESSENTIEL" as PlanType; // new clients start on ESSENTIEL
    const teamAgents = PLAN_AGENTS[plan];
    const names: string[] = [];
    for (const at of teamAgents) {
      names.push(await getAgentDisplayName(clientId, at));
    }

    let welcomeMsg = `Compte lie avec succes !\n\nBonjour ${client.firstName || displayName || ""} ! `;
    if (names.length === 1) {
      welcomeMsg += `Je suis ${names[0]}, votre assistante IA pour ${client.company}.`;
    } else {
      welcomeMsg += `Votre equipe IA pour ${client.company} est prete :\n`;
      for (let i = 0; i < teamAgents.length; i++) {
        welcomeMsg += `${AGENT_EMOJIS[teamAgents[i]]} ${names[i]}\n`;
      }
    }

    welcomeMsg += `\nVous pouvez me demander :\n- "Resume mes emails"\n- "Fais un devis pour..."\n- "Relance le client X"\n- Envoyez une PHOTO de chantier pour un devis automatique\n\nCommandes directes :\n/marie — Admin & secretariat\n/lucas — Marketing digital\n/samir — Commercial & prospection\n\nC'est parti !`;

    await sendMessage(phone, welcomeMsg);
    return;
  }

  // ── Aide / Help ──
  const lower = trimmed.toLowerCase();
  if (["aide", "help", "menu"].includes(lower)) {
    const client = await getClientByPhone(normalized);
    if (!client) {
      await sendMessage(
        phone,
        "Bienvenue sur iArtisan !\n\nPour connecter vos agents IA, envoyez votre code de liaison.\nVous le trouverez dans votre espace client sur iartisan.io > Onboarding > Canaux.\n\nExemple : link_votre-client-id"
      );
      return;
    }

    const plan = client.plan as PlanType;
    const teamAgents = PLAN_AGENTS[plan];
    const names: string[] = [];
    for (const at of teamAgents) {
      names.push(await getAgentDisplayName(client.id, at));
    }

    let helpText = `Votre equipe iArtisan :\n`;
    for (let i = 0; i < teamAgents.length; i++) {
      helpText += `${AGENT_EMOJIS[teamAgents[i]]} ${names[i]}\n`;
    }

    helpText += `\nCommandes directes :\n`;
    helpText += `/marie — Admin (devis, factures, emails, planning)\n`;
    if (teamAgents.includes("MARKETING")) {
      helpText += `/lucas — Marketing (Google, avis, SEO, reseaux)\n`;
    }
    if (teamAgents.includes("COMMERCIAL")) {
      helpText += `/samir — Commercial (prospects, leads, relances)\n`;
    }

    helpText += `\nFonctionnalites :\n`;
    helpText += `Vocal — envoyez un message vocal, il sera transcrit\n`;
    helpText += `Photo — envoyez une photo de chantier pour un devis\n`;
    helpText += `\nEcrivez simplement ce dont vous avez besoin, les agents concernes repondront !`;
    await sendMessage(phone, helpText);
    return;
  }

  // ── Lookup client ──
  const client = await getClientByPhone(normalized);

  if (!client) {
    // Handle "bonjour" / "hello" for unlinked users
    if (["bonjour", "hello"].includes(lower)) {
      await sendMessage(
        phone,
        "Bienvenue sur iArtisan !\n\nPour connecter vos agents IA, envoyez votre code de liaison.\nVous le trouverez dans votre espace client sur iartisan.io > Onboarding > Canaux.\n\nExemple : link_votre-client-id"
      );
      return;
    }

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

  // ── Determine the team ──
  const teamAgentTypes = PLAN_AGENTS[plan];
  const teamMembers: { type: AgentType; name: string }[] = [];
  for (const at of teamAgentTypes) {
    const name = await getAgentDisplayName(client.id, at);
    teamMembers.push({ type: at, name });
  }
  const isTeam = teamMembers.length > 1;

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
      // Falls through to text processing below
    } catch (err: any) {
      console.error("WhatsApp voice transcription error:", err);
      await sendMessage(
        phone,
        "Erreur de transcription du vocal. Envoyez un message texte."
      );
      return;
    }
  }

  // ── Handle IMAGE messages → Devis par photo (Marie only) ──
  if (mediaType === "image" && mediaId) {
    try {
      const marieName = teamMembers.find((m) => m.type === "ADMIN")?.name || "Marie";
      const prefix = isTeam ? `${AGENT_EMOJIS.ADMIN} ${marieName} :\n` : "";
      await sendMessage(phone, `${prefix}J'analyse ta photo...`);

      const imageData = await downloadWhatsAppImage(mediaId);
      if (!imageData) {
        await sendMessage(phone, `${prefix}Impossible de telecharger l'image. Reessaye.`);
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
        await sendMessage(phone, `${prefix}Erreur d'analyse : ${analysis.error}. Reessaye.`);
        return;
      }

      const response =
        analysis.devisEstimatif ||
        analysis.description ||
        "Analyse terminee mais aucun devis n'a pu etre genere.";
      await sendMessage(phone, prefix + response + (limitCheck.warning || ""));

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
      await sendMessage(phone, "Erreur lors de l'analyse de l'image. Reessayez.");
      return;
    }
  }

  // ── Normal text message ──
  if (!text) return;
  const warningText = limitCheck.warning || "";

  // ── 1) Parse explicit command (/marie, /lucas, /samir) ──
  const { command: agentCommand, remainingText } = parseAgentCommand(text);

  if (agentCommand) {
    // Check plan access
    if (!teamAgentTypes.includes(agentCommand)) {
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

    // Set as active agent for session
    await setActiveAgent(normalized, client.id, agentCommand);

    if (!remainingText) {
      // Just switching: only this agent responds with intro
      const agentName = teamMembers.find((m) => m.type === agentCommand)?.name || DEFAULT_AGENT_NAMES[agentCommand];
      const prefix = isTeam ? `${AGENT_EMOJIS[agentCommand]} ${agentName} :\n` : "";
      await sendMessage(
        phone,
        `${prefix}OK, c'est moi qui prends la main. Qu'est-ce que je peux faire pour toi ?`
      );
      return;
    }

    // Explicit command with message → ONLY this agent responds
    const result = await callAgentAndRespond(
      phone, normalized, client, agentCommand, remainingText,
      teamMembers, isTeam, warningText
    );

    if (result) {
      await supabase.from("agent_logs").insert({
        client_id: client.id,
        agent_type: result.agentType,
        action: "whatsapp.chat",
        tokens_used: result.tokensTotal,
        model_used: result.model,
        duration_ms: result.durationMs,
        cost_cents: Math.ceil((result.tokensTotal / 1000) * 0.0027 * 100),
        metadata: {
          whatsapp_phone: normalized,
          user_message: remainingText.substring(0, 200),
          agent_used: result.agentType,
          mode: "direct_command",
        },
      });
    }
    return;
  }

  // ── 2) Check for devis request (always handled by Marie) ──
  const lowerText = text.toLowerCase();
  const devisKeywords = ["devis", "quote", "estimation", "tarif", "prix", "chiffrage"];
  const isDevisRequest = devisKeywords.some((kw) => lowerText.includes(kw));

  if (isDevisRequest) {
    try {
      const marieName = teamMembers.find((m) => m.type === "ADMIN")?.name || "Marie";
      const prefix = isTeam ? `${AGENT_EMOJIS.ADMIN} ${marieName} :\n` : "";
      await sendMessage(phone, `${prefix}Je genere ton devis...`);

      const devisResult = await handleDevisGeneration({
        clientId: client.id,
        clientName: `Client ${new Date().getTime()}`,
        clientAddress: undefined,
        clientEmail: undefined,
        userPhone: normalized,
        userMessage: text,
      });

      if (devisResult.success && devisResult.documentUrl) {
        await sendDocument(
          phone,
          devisResult.documentUrl,
          devisResult.devisNumber || "devis.pdf",
          `${prefix}Devis ${devisResult.devisNumber}\n\nVoici ton devis. Telecharge-le, imprime-le ou dis-moi si tu veux des modifications.`
        );

        const successMsg =
          `${prefix}${devisResult.devisNumber} cree avec succes !\n\nLe PDF est envoye. Dis-moi si tu veux des modifications.` +
          warningText;
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
          `${prefix}Impossible de generer le PDF (${devisResult.error}). Je vais t'aider autrement...`
        );
        // Fall through to team LLM
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

  // ── 3) Team chat mode: score all agents and let relevant ones respond ──
  const scores = scoreAllAgents(text);

  // Determine which agents should respond
  let respondingAgents: AgentType[] = [];

  // Only consider agents in the team
  const teamScores = teamAgentTypes.map((at) => ({ type: at, score: scores[at] }));
  const scoredAgents = teamScores.filter((a) => a.score > 0);

  if (scoredAgents.length > 0) {
    // Agents with relevant keywords respond, sorted by score (highest first)
    respondingAgents = scoredAgents
      .sort((a, b) => b.score - a.score)
      .map((a) => a.type);
  } else {
    // Generic message (bonjour, question vague, etc.) → Marie responds
    respondingAgents = ["ADMIN"];

    // If this is a greeting and it's a team, Marie introduces the team
    const greetings = ["bonjour", "hello", "salut", "hey", "coucou", "bonsoir"];
    if (greetings.some((g) => lowerText.includes(g)) && isTeam) {
      const marieName = teamMembers.find((m) => m.type === "ADMIN")?.name || "Marie";
      const prefix = `${AGENT_EMOJIS.ADMIN} ${marieName} :\n`;
      let greeting = `${prefix}Salut ${client.firstName || ""} ! Ton equipe est la :\n`;
      for (const m of teamMembers) {
        greeting += `${AGENT_EMOJIS[m.type]} ${m.name}\n`;
      }
      greeting += `\nDis-nous ce dont tu as besoin, on s'en occupe !` + warningText;
      await sendMessage(phone, greeting);

      // Save to history
      await saveChatMessage(client.id, normalized, "ADMIN", "user", text);
      await saveChatMessage(client.id, normalized, "ADMIN", "assistant", greeting);

      await supabase.from("agent_logs").insert({
        client_id: client.id,
        agent_type: "ADMIN",
        action: "whatsapp.team_greeting",
        tokens_used: 0,
        model_used: "none",
        duration_ms: 0,
        cost_cents: 0,
        metadata: { whatsapp_phone: normalized, team_size: teamMembers.length },
      });
      return;
    }
  }

  // ── 4) Call each responding agent (sequentially to preserve message order) ──
  const usePrefix = isTeam; // prefix only if team has > 1 member

  for (const agentType of respondingAgents) {
    try {
      const result = await callAgentAndRespond(
        phone, normalized, client, agentType, text,
        teamMembers, usePrefix,
        // Only append warning to the LAST agent's message
        agentType === respondingAgents[respondingAgents.length - 1] ? warningText : ""
      );

      if (result) {
        await supabase.from("agent_logs").insert({
          client_id: client.id,
          agent_type: result.agentType,
          action: "whatsapp.chat",
          tokens_used: result.tokensTotal,
          model_used: result.model,
          duration_ms: result.durationMs,
          cost_cents: Math.ceil((result.tokensTotal / 1000) * 0.0027 * 100),
          metadata: {
            whatsapp_phone: normalized,
            user_message: text.substring(0, 200),
            agent_used: result.agentType,
            mode: "team_chat",
            responding_agents: respondingAgents,
            scores,
          },
        });
      }
    } catch (err: any) {
      console.error(`Agent ${agentType} response error:`, err);
      // Continue with other agents even if one fails
    }
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
    status: WHATSAPP_ACCESS_TOKEN ? "configured" : "not_configured",
    features: ["multi-agent", "team-chat", "voice", "image", "devis-pdf"],
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
