/**
 * iArtisan Orchestrator — Router LLM (classifier)
 *
 * Replaces the old keyword scoring + broadcast. A single Haiku-class call
 * decides which agent should respond to a given message, with structured
 * JSON output. Fast, cheap, robust.
 *
 * Cost: ~0.1¢/turn on Haiku. Latency: ~400-700ms.
 *
 * Path: lib/agents/router.ts
 */

import { callLLM } from "@/lib/agents/llm";
import type { AgentType } from "@/lib/agents/types";

export type RouterIntent =
  // ADMIN
  | "devis"
  | "facture"
  | "relance_paiement"
  | "email_client"
  | "planning"
  | "rapport_hebdo"
  | "resume_inbox"
  // MARKETING
  | "post_gmb"
  | "post_social"
  | "review_response"
  | "seo_audit"
  | "site_update"
  // COMMERCIAL
  | "prospection"
  | "qualify_lead"
  | "annuaires"
  | "marche_public"
  | "recouvrement"
  | "negociation_fournisseur"
  // META
  | "smalltalk"
  | "weekly_summary_cross"
  | "unknown";

export interface RouterDecision {
  /** Primary agent that owns the response. Always exactly one. */
  target_agent: AgentType;
  /** Best-effort intent classification. Used for logs & default tool selection. */
  intent: RouterIntent;
  /** Whether the user expects an artefact (PDF, scheduled task, message sent…). */
  needs_artifact: boolean;
  /** True if the request crosses multiple domains and the orchestrator should
   *  let the target agent invoke `delegate(...)` to fetch input from peers. */
  cross_domain: boolean;
  /** Confidence 0..1 from the model's own self-assessment. */
  confidence: number;
  /** Free-text rationale, kept short, used for logs only. */
  reason: string;
}

const INTENT_TO_AGENT: Record<RouterIntent, AgentType> = {
  devis: "ADMIN",
  facture: "ADMIN",
  relance_paiement: "ADMIN",
  email_client: "ADMIN",
  planning: "ADMIN",
  rapport_hebdo: "ADMIN",
  resume_inbox: "ADMIN",
  post_gmb: "MARKETING",
  post_social: "MARKETING",
  review_response: "MARKETING",
  seo_audit: "MARKETING",
  site_update: "MARKETING",
  prospection: "COMMERCIAL",
  qualify_lead: "COMMERCIAL",
  annuaires: "COMMERCIAL",
  marche_public: "COMMERCIAL",
  recouvrement: "COMMERCIAL",
  negociation_fournisseur: "COMMERCIAL",
  smalltalk: "ADMIN",
  weekly_summary_cross: "ADMIN",
  unknown: "ADMIN",
};

const ROUTER_SYSTEM_PROMPT = `Tu es le ROUTER d'une équipe d'agents IA pour artisans (iArtisan).
Ta seule mission : lire un message reçu sur WhatsApp et décider QUEL agent doit répondre.

Équipe :
- ADMIN (Marie) : devis, factures, emails clients, relances de paiement, planning/RDV, résumé inbox, rapport hebdo.
- MARKETING (Lucas) : Google Business Profile, posts réseaux sociaux, réponse aux avis, SEO local, mise à jour site web.
- COMMERCIAL (Samir) : prospection, qualification de leads, annuaires (Habitatpresto, etc.), marchés publics, recouvrement d'impayés, négociation fournisseurs.

Règles strictes :
1. Tu retournes UNIQUEMENT un JSON valide, aucun texte autour.
2. Un seul target_agent par décision. Pas de broadcast.
3. Si le message demande un résumé global (ex: "résume ma semaine", "fais le point") qui touche admin + commercial : target_agent=ADMIN, intent=weekly_summary_cross, cross_domain=true.
4. needs_artifact=true si le message attend un livrable concret (PDF, post programmé, email envoyé, lead qualifié, prix négocié, etc.). false pour discussion / question de clarification / bonjour.
5. Si tu hésites entre ADMIN et un autre agent → choisis l'autre. Marie n'est pas le standard téléphonique.
6. Smalltalk ("salut", "ça va") → target_agent=ADMIN, intent=smalltalk, needs_artifact=false.

Format JSON exact (toutes les clés obligatoires) :
{"target_agent":"ADMIN|MARKETING|COMMERCIAL","intent":"<intent>","needs_artifact":true|false,"cross_domain":true|false,"confidence":0.0-1.0,"reason":"<≤120 chars>"}`;

/**
 * Route a message to a single agent.
 * Falls back to ADMIN with low confidence if the LLM output can't be parsed.
 */
export async function routeMessage(opts: {
  text: string;
  availableAgents: AgentType[];
  recentHistorySnippet?: string;
}): Promise<RouterDecision> {
  const { text, availableAgents, recentHistorySnippet } = opts;

  const userPrompt = [
    recentHistorySnippet
      ? `Contexte récent (les 3 derniers tours de la conversation) :\n${recentHistorySnippet}\n`
      : "",
    `Message à router :\n"""${text.slice(0, 1500)}"""`,
    `Agents disponibles dans l'équipe de cet artisan : ${availableAgents.join(", ")}.`,
    `Si ta cible idéale n'est pas dans cette liste, retombe sur ADMIN (Marie reste toujours dispo).`,
  ]
    .filter(Boolean)
    .join("\n\n");

  let parsed: RouterDecision | null = null;

  try {
    const response = await callLLM({
      taskType: "router.classify",
      systemPrompt: ROUTER_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 200,
      temperature: 0.0,
    });

    const raw = (response.content || "").trim();
    // Strip code fences if the model added them despite instructions
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    const obj = JSON.parse(cleaned);

    const target = (obj.target_agent || "").toString().toUpperCase();
    const intent = (obj.intent || "unknown").toString();

    if (!["ADMIN", "MARKETING", "COMMERCIAL"].includes(target)) {
      throw new Error(`invalid target_agent: ${target}`);
    }

    let final: AgentType = target as AgentType;
    if (!availableAgents.includes(final)) {
      // Plan limitation: target not in this artisan's team → fallback to ADMIN
      final = "ADMIN";
    }

    parsed = {
      target_agent: final,
      intent: intent as RouterIntent,
      needs_artifact: !!obj.needs_artifact,
      cross_domain: !!obj.cross_domain,
      confidence: typeof obj.confidence === "number" ? obj.confidence : 0.5,
      reason: (obj.reason || "").toString().slice(0, 120),
    };
  } catch (err: any) {
    // Defensive fallback: keyword sniff on a tiny vocabulary, ADMIN otherwise.
    parsed = keywordFallback(text, availableAgents);
    parsed.reason = `parse_fail:${(err?.message || "unknown").slice(0, 60)}|fallback`;
  }

  return parsed!;
}

/**
 * Last-resort heuristic if the LLM router crashes (network, parse error, etc.).
 * Intentionally minimal — we only need it to keep iArtisan responsive.
 */
function keywordFallback(text: string, available: AgentType[]): RouterDecision {
  const t = text.toLowerCase();
  let target: AgentType = "ADMIN";
  let intent: RouterIntent = "unknown";

  if (/\b(avis|google|gmb|seo|insta|facebook|post|réseau|reseau|site|réputation|reputation)\b/.test(t)) {
    target = "MARKETING";
    intent = "post_gmb";
  } else if (/\b(prospect|lead|annuaire|marché|marche|chantier|impay[eé]|recouvrement|fournisseur)\b/.test(t)) {
    target = "COMMERCIAL";
    intent = "prospection";
  } else if (/\b(devis|facture|relance|email|planning|rdv|rendez-vous|résum|resum)\b/.test(t)) {
    target = "ADMIN";
    intent = "devis";
  }

  if (!available.includes(target)) target = "ADMIN";

  return {
    target_agent: target,
    intent,
    needs_artifact: /\b(devis|envoi|publi|programme|génère|genere|fais|sors)\b/.test(t),
    cross_domain: false,
    confidence: 0.3,
    reason: "keyword_fallback",
  };
}
