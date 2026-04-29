/**
 * Test Chat API — /api/test/chat
 *
 * Endpoint for the web test interface (test-agents.html).
 * Accepts { agent: "ADMIN"|"MARKETING"|"COMMERCIAL", message: string, clientId?: string }
 * Returns the agent's response using the real system prompt from Supabase.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callLLM } from "@/lib/agents/llm";
import { AgentType, DEFAULT_AGENT_NAMES } from "@/lib/agents/types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Simple auth: only allow in dev or with a test key
const TEST_API_KEY = process.env.TEST_API_KEY || "iartisan-test-2026";

export async function POST(request: NextRequest) {
  // Check test API key
  const authHeader = request.headers.get("x-test-key");
  if (authHeader !== TEST_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { agent, message, clientId, history } = await request.json();

  if (!agent || !message) {
    return NextResponse.json(
      { error: "agent and message required" },
      { status: 400 }
    );
  }

  const agentType = agent as AgentType;
  const testClientId = clientId || "test-client-001";

  // Load client
  const { data: client } = await supabase
    .from("clients")
    .select("id, plan, company, metier, ville, firstName, lastName")
    .eq("id", testClientId)
    .single();

  if (!client) {
    return NextResponse.json(
      { error: `Client ${testClientId} not found` },
      { status: 404 }
    );
  }

  // Load agent config
  const { data: agentConfig } = await supabase
    .from("agent_configs")
    .select("display_name, instructions, personality")
    .eq("client_id", testClientId)
    .eq("agent_type", agentType)
    .single();

  // Build system prompt (same logic as webhook)
  const agentName =
    agentConfig?.display_name || DEFAULT_AGENT_NAMES[agentType];
  const instructions = agentConfig?.instructions || "";
  const personality = agentConfig?.personality || {};
  const tutoiement = personality.tutoiement !== false;
  const tone = personality.tone || "professionnel";

  const roleLabels: Record<AgentType, string> = {
    ADMIN: "secretaire / assistante administrative",
    MARKETING: "responsable marketing digital",
    COMMERCIAL: "responsable commercial / apporteur d'affaires",
  };

  let systemPrompt = `Tu es ${agentName}, ${roleLabels[agentType]} de l'entreprise "${client.company}" (${client.metier} a ${client.ville}).

IMPORTANT : Tu t'adresses TOUJOURS a ${client.firstName || "ton patron"} (l'artisan, le dirigeant). C'est LUI ton interlocuteur, ton patron. Tu es son bras droit.
${tutoiement ? "Tu TUTOIES toujours ton patron. Tu es chaleureuse, directe, comme une collegue de confiance." : "Tu vouvoies ton interlocuteur."}
Quand tu rediges un message pour un CLIENT FINAL (devis, relance, email), tu VOUVOIES TOUJOURS le client final.
Tu parles toujours en francais sauf si ton patron te parle dans une autre langue.

STYLE :
- Messages concis et clairs
- Pas de Markdown (pas de ** ou ## ou -)
- Toujours proposer une action concrete
- Ton ${tone}

`;

  // ─── Agent scope: what this agent can and cannot do ───
  const scopeDescriptions: Record<AgentType, string> = {
    ADMIN: `TON PERIMETRE (ce que tu sais faire) :
- Lire et repondre aux emails
- Generer des devis et factures
- Relancer les clients (paiements, suivi)
- Faire un rapport hebdomadaire
- Resume d'emails

CE QUI N'EST PAS TON ROLE :
- Marketing, SEO, reseaux sociaux, fiche Google → dis a ton patron de demander a Lucas
- Prospection, qualification de leads, annuaires → dis a ton patron de demander a Samir`,

    MARKETING: `TON PERIMETRE (ce que tu sais faire) :
- Optimiser la fiche Google Business Profile
- Publier des posts sur Google, reseaux sociaux
- Repondre aux avis clients en ligne
- Audit SEO local
- Mise a jour du site web

CE QUI N'EST PAS TON ROLE :
- Devis, factures, emails clients, relances de paiement → dis a ton patron de demander a Marie
- Prospection, qualification de leads, annuaires → dis a ton patron de demander a Samir
Tu ne generes JAMAIS de devis, facture ou document administratif.`,

    COMMERCIAL: `TON PERIMETRE (ce que tu sais faire) :
- Prospecter et trouver de nouveaux clients
- Qualifier les leads entrants
- Repondre aux demandes de prospects
- Envoyer des emails de prospection
- Inscrire l'entreprise sur les annuaires
- Relancer les impayes

CE QUI N'EST PAS TON ROLE :
- Gestion des emails courants, devis detailles, factures → dis a ton patron de demander a Marie
- Marketing, SEO, fiche Google, reseaux sociaux → dis a ton patron de demander a Lucas`,
  };

  systemPrompt += `\n${scopeDescriptions[agentType]}\n\nSi ton patron te demande quelque chose hors de ton perimetre, ne dis PAS "ok je m'en occupe". Dis-lui clairement que ce n'est pas ton domaine et oriente-le vers le bon agent.\n`;

  if (instructions) {
    systemPrompt += `INSTRUCTIONS SPECIFIQUES :\n${instructions}\n\n`;
  }

  if (personality.restrictions && personality.restrictions.length > 0) {
    systemPrompt += `RESTRICTIONS :\n${personality.restrictions
      .map((r: string) => `- ${r}`)
      .join("\n")}\n\n`;
  }

  // Build user prompt with history context
  let userPrompt = message;
  if (history && history.length > 0) {
    const historyText = history
      .map(
        (m: any) =>
          `${m.role === "user" ? client.firstName || "Patron" : agentName}: ${m.content}`
      )
      .join("\n");
    userPrompt = `[Historique recent]\n${historyText}\n\n[Message actuel]\n${message}`;
  }

  const startTime = Date.now();

  const response = await callLLM({
    taskType: "email.reply",
    systemPrompt,
    userPrompt,
    maxTokens: 1024,
    temperature: 0.5,
  });

  const durationMs = Date.now() - startTime;

  return NextResponse.json({
    agent: agentType,
    agentName,
    content: response.content || "Erreur de generation.",
    model: response.model,
    tokensUsed: response.tokensUsed,
    durationMs,
    systemPromptPreview: systemPrompt.substring(0, 300) + "...",
  });
}
