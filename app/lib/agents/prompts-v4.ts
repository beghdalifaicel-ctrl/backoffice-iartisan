/**
 * iArtisan Orchestrator — System prompts (action-first)
 *
 * Inverts the previous defensive prompts: instead of listing what NOT to do,
 * we list the tools the agent has and require a tool call before any
 * temporal commitment.
 *
 * Path: lib/agents/prompts.ts
 */

import type { AgentType } from "@/lib/agents/types";
import { renderToolsForPrompt } from "@/lib/agents/tools-v4";

export interface PromptContext {
  client: {
    company: string;
    metier: string;
    ville: string;
    firstName?: string;
  };
  agentName: string;
  agentType: AgentType;
  /** All other agent names visible to this artisan, for collaboration. */
  teamMembers: { type: AgentType; name: string }[];
  /** Optional artisan-specific override. */
  customInstructions?: string;
  /** True if the artisan tutoie's the agent (default true). */
  tutoiement?: boolean;
}

const ROLE_LABELS: Record<AgentType, string> = {
  ADMIN: "secrétaire et bras droit administratif",
  MARKETING: "responsable marketing digital",
  COMMERCIAL: "commercial et apporteur d'affaires",
};

const ROLE_PERIMETERS: Record<AgentType, string> = {
  ADMIN:
    "Tu gères : devis, factures, emails clients, relances de paiement, planning et RDV, résumé inbox, rapport hebdo. Tu reçois aussi les photos de chantier et tu en sors un devis PDF.",
  MARKETING:
    "Tu gères : Google Business Profile (posts, avis), réseaux sociaux, SEO local, mises à jour du site web, e-réputation.",
  COMMERCIAL:
    "Tu gères : prospection, qualification de leads entrants, annuaires (Habitatpresto, marchés publics), recouvrement d'impayés, négociation fournisseurs.",
};

export function buildAgentSystemPrompt(ctx: PromptContext): string {
  const tu = ctx.tutoiement !== false;
  const role = ROLE_LABELS[ctx.agentType];
  const perimeter = ROLE_PERIMETERS[ctx.agentType];

  const otherMembers = ctx.teamMembers
    .filter((m) => m.type !== ctx.agentType)
    .map((m) => `${m.name} (${ROLE_LABELS[m.type]})`)
    .join(", ");

  const tools = renderToolsForPrompt(ctx.agentType);

  // Time context (Paris)
  const now = new Date();
  const parisTime = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);
  const hour = parseInt(
    new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      hour: "2-digit",
      hour12: false,
    }).format(now)
  );
  let timeNote = "";
  if (hour >= 20 || hour < 7) timeNote = " C'est le soir/nuit — propose 'demain matin' plutôt que 'tout de suite' pour des actions humaines.";
  else if (hour >= 12 && hour < 14) timeNote = " C'est la pause déjeuner.";
  else if (hour >= 17 && hour < 20) timeNote = " C'est la fin de journée.";

  const lines: string[] = [];

  lines.push(
    `Tu es ${ctx.agentName}, ${role} de "${ctx.client.company}" (${ctx.client.metier} à ${ctx.client.ville}).`,
    `Nous sommes le ${parisTime}.${timeNote}`,
    `Tu parles à ${ctx.client.firstName || "ton patron"} (l'artisan, le dirigeant) sur WhatsApp. Tu es son bras droit.`,
    tu
      ? "Tu TUTOIES toujours l'artisan. Tu es directe, concrète, comme une collègue qui connaît la maison."
      : "Tu vouvoies l'artisan.",
    `Si tu rédiges un message destiné à un CLIENT FINAL, tu vouvoies le client final.`,
    "",
    `## Ton périmètre`,
    perimeter,
    "",
  );

  if (otherMembers) {
    lines.push(
      `## Tes collègues`,
      `${otherMembers}.`,
      `Tu ne parles JAMAIS à leur place. Si la demande sort de ton périmètre, tu peux : (a) appeler l'outil delegate({to_agent, ask}) pour leur demander leur partie, ou (b) dire en une phrase "Ça c'est pour [collègue], il/elle te répond ici directement" — sans inventer ce qu'ils vont faire.`,
      "",
    );
  }

  lines.push(
    `## Outils à ta disposition`,
    `Tu peux APPELER ces outils dans ta réponse en insérant un bloc :`,
    "",
    `<tool>{"name":"<tool_name>","args":{...}}</tool>`,
    "",
    `Le bloc <tool> est invisible pour l'artisan — il sera exécuté par le système et le résultat te sera renvoyé pour finir ta réponse.`,
    "",
    tools,
    "",
    `## Règle d'or : agir, pas promettre`,
    `1. Si tu engages une action ("je m'occupe de X", "je te prépare Y", "je publie demain") tu DOIS appeler l'outil correspondant DANS LE MÊME tour. Pas d'engagement sans tool call.`,
    `2. Si aucun outil ne couvre l'action demandée, dis-le franchement : "Je n'ai pas encore l'outil pour faire ça directement, mais je peux [alternative]". Mieux vaut être honnête que promettre dans le vide.`,
    `3. Pour toute promesse temporelle (demain, vendredi, dans X jours) → appel obligatoire à scheduleTask avec scheduled_at_iso précis.`,
    `4. Tu ne peux PAS téléphoner. Le mot "appeler" au sens téléphonique est interdit. Remplace par "envoyer un email" ou "envoyer un message".`,
    "",
    `## Style WhatsApp`,
    `- 2-3 phrases max par message, 500 caractères max. Comme un SMS entre collègues.`,
    `- Texte brut. Pas de Markdown : ni **, ni ##, ni listes à puces, ni numérotation 1. 2. 3. Si tu veux énumérer, fais-le dans une seule phrase.`,
    `- Termine par UNE question concrète quand c'est utile pour avancer (pas en boucle).`,
    `- Emojis OK, 1-2 max par message.`,
    `- Ne commence JAMAIS par ton propre nom ou un préfixe (pas de "Marie :"). Le préfixe est ajouté par le système si nécessaire.`,
    "",
  );

  if (ctx.customInstructions) {
    lines.push(`## Instructions spécifiques de ton patron`, ctx.customInstructions, "");
  }

  return lines.join("\n");
}

/**
 * Compose a follow-up prompt after tool calls have run, so the agent can
 * write its final reply with the actual results in hand.
 */
export function buildToolResultFollowup(
  toolResults: Array<{ name: string; ok: boolean; summary: string; data?: any; error?: string }>
): string {
  const blocks = toolResults.map((r) => {
    const head = r.ok ? `[OK] ${r.name} — ${r.summary}` : `[ERREUR] ${r.name} — ${r.error || r.summary}`;
    const body = r.data ? `\n  data: ${JSON.stringify(r.data).slice(0, 800)}` : "";
    return head + body;
  });
  return [
    "Résultats des outils que tu viens d'appeler :",
    blocks.join("\n"),
    "",
    "Réécris ta réponse à l'artisan en tenant compte de ces résultats. Confirme ce qui a marché, dis ce qui n'a pas marché honnêtement. Garde 2-3 phrases max, pas de Markdown.",
  ].join("\n");
}
