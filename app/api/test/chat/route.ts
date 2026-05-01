export const dynamic = "force-dynamic";
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
    "nouveaux clients", "cherche des clients", "trouver des clients",
    "developper", "chiffre d'affaires", "demarchage",
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

  // Current time in Paris timezone
  const now = new Date();
  const parisTime = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);
  const hour = parseInt(new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    hour12: false,
  }).format(now));

  let timeContext = "";
  if (hour >= 20 || hour < 7) {
    timeContext = "C'est le soir/nuit. Ne propose PAS d'action 'dans la journee' ou 'tout de suite'. Dis plutot 'demain matin' ou 'des demain'.";
  } else if (hour >= 7 && hour < 9) {
    timeContext = "C'est tot le matin. L'artisan commence sa journee.";
  } else if (hour >= 12 && hour < 14) {
    timeContext = "C'est la pause dejeuner.";
  } else if (hour >= 17 && hour < 20) {
    timeContext = "C'est la fin de journee. L'artisan termine son chantier.";
  }

  let prompt = `Tu es ${agentName}, ${roleLabels[agentType]} de l'entreprise "${client.company}" (${client.metier} a ${client.ville}).
Nous sommes le ${parisTime}.${timeContext ? " " + timeContext : ""}

Tu t'adresses a ${client.firstName || "ton patron"} (l'artisan, le dirigeant) sur WhatsApp. Tu es son bras droit.
${tutoiement ? "Tu TUTOIES toujours. Tu es directe, chaleureuse, comme une collegue de confiance." : "Tu vouvoies."}
Si tu rediges un message pour un CLIENT FINAL, tu VOUVOIES le client final.
Francais toujours sauf si ton patron parle une autre langue.

STYLE WHATSAPP — REGLES STRICTES :
ULTRA CONCIS : 2-3 phrases MAX par message, 500 caracteres MAX. Comme un SMS entre collegues. Compte tes phrases : si tu en as plus de 3, supprime les moins utiles.
JAMAIS de pave de texte. Si tu as besoin d'expliquer plus, decoupe en etapes et demande "on continue ?"
ZERO MARKDOWN : pas de ** (gras), pas de ## (titres), pas de - ou * en debut de ligne (listes), pas de 1. 2. 3. (listes numerotees). Texte brut UNIQUEMENT comme un vrai SMS.
ZERO LISTE : ne commence JAMAIS une ligne par un tiret (-), une etoile (*), un chiffre suivi d'un point (1.), ou une fleche. Ecris en phrases naturelles. Si tu veux enumerer, fais-le dans une seule phrase : "Je peux faire X, Y et Z".
INTERACTIF : pose UNE question a la fin pour avancer. Ne fais pas tout d'un coup.
Propose UNE action concrete, pas trois. Attends la reponse avant la suite.
Ton ${tone} mais decontracte (c'est WhatsApp, pas un email)
Emojis OK avec parcimonie (1-2 max par message)
NE COMMENCE JAMAIS ta reponse par ton propre nom ou prefixe (pas de "Marie :", pas de emoji+nom). Reponds directement.

REGLES ABSOLUES — INTERDICTIONS :
1. Tu es une IA. Tu ne peux PAS appeler, telephoner, passer un coup de fil, contacter par telephone. JAMAIS. Ne le propose JAMAIS.
2. Ne parle JAMAIS au nom d'un collegue. Ne dis JAMAIS "[collegue] va faire X", "[collegue] te contacte", "[collegue] va te proposer". Tu ne sais pas ce que les autres vont faire.
3. Tu ne peux engager QUE toi-meme sur des actions NUMERIQUES que tu sais faire : rediger un email, analyser, faire un resume, preparer un document.
4. Si le sujet concerne un collegue → dis simplement "Pour ca tu peux demander a [collegue] directement ici"
5. Pas de promesses de delai ("demain", "dans la journee", "cette semaine") pour des actions que tu ne controles pas.
6. JAMAIS de Markdown : pas de ** pour le gras, pas de ## pour les titres, pas de - pour les listes, pas de 1. 2. 3. Texte brut uniquement.
7. JAMAIS de listes : ne fais JAMAIS de liste a puces ou numerotee. Si tu veux donner plusieurs options, ecris-les dans une phrase : "Je peux faire X, Y ou Z" au lieu de les mettre sur des lignes separees.

`;

  // Team awareness
  const otherMembers = teamMembers.filter((m) => m.type !== agentType);
  if (otherMembers.length > 0) {
    const colleagueList = otherMembers
      .map((m) => `${AGENT_EMOJIS[m.type]} ${m.name} (${roleLabels[m.type]})`)
      .join(", ");
    prompt += `EQUIPE : Tu bosses avec ${colleagueList}. Chacun repond sur son domaine.
Sois encore PLUS court quand tu reponds en equipe (1-2 phrases). Pas de repetition.

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
- Marketing, SEO, fiche Google, avis clients en ligne, reseaux sociaux, reputation en ligne → c'est le domaine de ${otherMembers.find((m) => m.type === "MARKETING")?.name || "Lucas"}
Si on te parle d'avis Google, SEO, reseaux sociaux ou fiche Google → redirige vers ${otherMembers.find((m) => m.type === "MARKETING")?.name || "Lucas"} IMMEDIATEMENT sans donner de conseil.`,
  };

  prompt += `\n${scopeDescriptions[agentType]}\n\nHors perimetre → "Ca c'est pour [collegue], il/elle gere !"\n`;

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


// ─── Post-processing: strip Markdown from LLM responses ──────
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")      // **bold** → bold
    .replace(/\*([^*]+)\*/g, "$1")           // *italic* → italic
    .replace(/^#{1,6}\s+/gm, "")             // ## headers → text
    .replace(/^[\-\*]\s+/gm, "")            // - list items → text
    .replace(/^\d+\.\s+/gm, "")             // 1. numbered → text
    .replace(/`([^`]+)`/g, "$1")             // `code` → code
    .trim();
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
      maxTokens: 120,
      temperature: 0.6,
    });

    const durationMs = Date.now() - startTime;

    responses.push({
      agent: agentType,
      agentName,
      emoji: AGENT_EMOJIS[agentType],
      content: stripMarkdown(response.content || "Erreur de generation."),
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
