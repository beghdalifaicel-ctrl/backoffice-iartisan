/**
 * Test Chat API — /api/test/chat (Team Chat Mode)
 *
 * Endpoint for the web test interface (test-agents.html).
 * Accepts { message: string, clientId?: string, plan?: string, targetAgent?: string, history?: array, clientOverride?: object }
 *
 * In team mode:
 * - Scores message against all agents in the plan
 * - Returns responses from all relevant agents
 * - Each response includes emoji + agent name prefix
 *
 * If targetAgent is specified, only that agent responds (simulates /command).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callLLM } from "@/lib/agents/llm";
import {
  AgentType,
  PlanType,
  PLAN_AGENTS,
  DEFAULT_AGENT_NAMES,
} from "@/lib/agents/types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TEST_API_KEY = process.env.TEST_API_KEY || "iartisan-test-2026";

const AGENT_EMOJIS: Record<AgentType, string> = {
  ADMIN: "🟣",
  MARKETING: "🟢",
  COMMERCIAL: "🔴",
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

  // Team awareness
  const otherMembers = teamMembers.filter((m) => m.type !== agentType);
  if (otherMembers.length > 0) {
    const colleagueList = otherMembers
      .map((m) => `${AGENT_EMOJIS[m.type]} ${m.name} (${roleLabels[m.type]})`)
      .join(", ");
    prompt += `EQUIPE : Tu fais partie d'une equipe avec ${colleagueList}.
Quand ton patron envoie un message, chaque membre de l'equipe concernee repond.
- Reponds UNIQUEMENT sur ce qui releve de TON domaine d'expertise
- Ne repete PAS ce que tes collegues pourraient deja dire
- Sois concis : ton patron lira aussi les reponses de tes collegues
- Si le message ne te concerne pas du tout, ne reponds pas (le systeme le gere)

`;
  }

  // Scope
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

  prompt += `\n${scopeDescriptions[agentType]}\n\nSi ton patron te demande quelque chose hors de ton perimetre, dis-lui que ton/ta collegue s'en occupe (il/elle repondra dans ce meme fil).\n`;

  if (instructions) {
    prompt += `\nINSTRUCTIONS SPECIFIQUES :\n${instructions}\n`;
  }

  if (personality.restrictions && personality.restrictions.length > 0) {
    prompt += `\nRESTRICTIONS :\n${personality.restrictions
      .map((r: string) => `- ${r}`)
      .join("\n")}\n`;
  }

  return prompt;
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("x-test-key");
  if (authHeader !== TEST_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { message, clientId, plan: overridePlan, targetAgent, history, clientOverride } = await request.json();

  if (!message) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  const testClientId = clientId || "test-client-001";

  // Load client from Supabase
  const { data: dbClient } = await supabase
    .from("clients")
    .select("id, plan, company, metier, ville, firstName, lastName")
    .eq("id", testClientId)
    .single();

  if (!dbClient) {
    return NextResponse.json({ error: `Client ${testClientId} not found` }, { status: 404 });
  }

  // Apply client overrides (from test UI artisan profile selector)
  const client = {
    ...dbClient,
    ...(clientOverride?.firstName && { firstName: clientOverride.firstName }),
    ...(clientOverride?.company && { company: clientOverride.company }),
    ...(clientOverride?.metier && { metier: clientOverride.metier }),
    ...(clientOverride?.ville && { ville: clientOverride.ville }),
  };

  // Determine plan and team
  const plan = (overridePlan || client.plan || "ESSENTIEL") as PlanType;
  const teamAgentTypes = PLAN_AGENTS[plan];

  // Build team members list
  const teamMembers: { type: AgentType; name: string }[] = [];
  for (const at of teamAgentTypes) {
    const { data: config } = await supabase
      .from("agent_configs")
      .select("display_name")
      .eq("client_id", testClientId)
      .eq("agent_type", at)
      .single();
    teamMembers.push({
      type: at,
      name: config?.display_name || DEFAULT_AGENT_NAMES[at],
    });
  }

  // Determine which agents respond
  let respondingAgents: AgentType[];

  if (targetAgent) {
    // Direct command mode: only this agent
    const agentType = targetAgent as AgentType;
    if (!teamAgentTypes.includes(agentType)) {
      return NextResponse.json({
        error: `${DEFAULT_AGENT_NAMES[agentType]} n'est pas disponible avec le plan ${plan}`,
      }, { status: 403 });
    }
    respondingAgents = [agentType];
  } else {
    // Team mode: score and route
    const scores = scoreAllAgents(message);
    const teamScores = teamAgentTypes.map((at) => ({ type: at, score: scores[at] }));
    const scored = teamScores.filter((a) => a.score > 0);

    if (scored.length > 0) {
      respondingAgents = scored.sort((a, b) => b.score - a.score).map((a) => a.type);
    } else {
      respondingAgents = ["ADMIN"]; // Default: Marie
    }
  }

  const isTeam = teamMembers.length > 1;
  const responses: any[] = [];

  for (const agentType of respondingAgents) {
    const { data: agentConfig } = await supabase
      .from("agent_configs")
      .select("display_name, instructions, personality")
      .eq("client_id", testClientId)
      .eq("agent_type", agentType)
      .single();

    const agentName = agentConfig?.display_name || DEFAULT_AGENT_NAMES[agentType];
    const systemPrompt = buildSystemPrompt(client, agentType, agentName, agentConfig, teamMembers);

    let userPrompt = message;
    if (history && history.length > 0) {
      const historyText = history
        .map((m: any) => `${m.role === "user" ? client.firstName || "Patron" : m.agentName || "Agent"}: ${m.content}`)
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

    responses.push({
      agent: agentType,
      agentName,
      emoji: AGENT_EMOJIS[agentType],
      content: response.content || "Erreur de generation.",
      prefixed: isTeam
        ? `${AGENT_EMOJIS[agentType]} ${agentName} :\n${response.content || "Erreur de generation."}`
        : response.content || "Erreur de generation.",
      model: response.model,
      tokensUsed: response.tokensUsed,
      durationMs,
    });
  }

  return NextResponse.json({
    mode: targetAgent ? "direct" : "team",
    plan,
    client: { firstName: client.firstName, company: client.company, metier: client.metier, ville: client.ville },
    team: teamMembers.map((m) => ({ ...m, emoji: AGENT_EMOJIS[m.type] })),
    respondingAgents,
    scores: scoreAllAgents(message),
    responses,
  });
}
