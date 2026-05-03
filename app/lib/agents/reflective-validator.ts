/**
 * Reflective Validator — auto-correction temps réel.
 *
 * Avant d'envoyer la réponse de l'agent à l'artisan via WhatsApp, on appelle
 * un LLM "réflexif" (Mistral medium via callLLM) qui relit le tour et
 * détecte les violations sémantiques que les regex du programmatic guard
 * ne peuvent pas voir :
 *
 *   - temporal_promise_no_tool : promet "demain matin" sans scheduleTask
 *   - mention_other_agent      : mentionne Marie/Lucas/Samir spontanément
 *   - speak_for_other_agent    : "Samir te contacte demain"
 *   - out_of_scope             : Samir parle devis, Marie parle GMB, etc.
 *   - self_flagellation        : "Désolée j'ai merdé"
 *   - markdown_formatting      : ##, **, listes à puces
 *   - too_long                 : > 500 caractères
 *   - invented_capability      : "j'envoie un SMS / je téléphone"
 *   - invented_data            : invente leads / scraping / chiffres
 *
 * Si une violation MAJEURE est détectée, needs_retry=true.
 * L'orchestrator relance alors l'agent avec un prompt de correction
 * (limite à 1 retry max pour éviter les boucles + maîtriser le coût).
 *
 * Les minor violations sont laissées au programmatic guard qui les nettoie.
 *
 * Tous les retries sont persistés dans agent_retries pour observabilité
 * (statistiques de qualité du validateur, alimentation future de Couche 1).
 */

import { callLLM } from '@/lib/agents/llm';
import type { AgentType } from '@/lib/agents/types';

export type ViolationType =
  | 'temporal_promise_no_tool'
  | 'mention_other_agent'
  | 'speak_for_other_agent'
  | 'out_of_scope'
  | 'self_flagellation'
  | 'markdown_formatting'
  | 'too_long'
  | 'invented_capability'
  | 'invented_data'
  | 'other';

export interface Violation {
  type: ViolationType;
  severity: 'minor' | 'major';
  explanation: string;
}

export interface ValidatorInput {
  agentType: AgentType;
  agentName: string;
  userMessage: string;
  agentReply: string;
  contextSnippet?: string;
  /** Names of tools the agent called this turn. */
  toolCallsMade: string[];
  customInstructions?: string;
}

export interface ValidatorVerdict {
  needs_retry: boolean;
  violations: Violation[];
  correction_hint: string;
  /** Raw LLM JSON for observability/debug. */
  raw?: any;
}

const ROLE_SUMMARIES: Record<AgentType, string> = {
  ADMIN:
    "secrétaire administratif — devis, factures, emails clients, relances de paiement, planning, RDV. Reçoit aussi photos de chantier et génère devis PDF.",
  MARKETING:
    "responsable marketing digital — Google Business Profile (posts, avis), réseaux sociaux, SEO local, site web, e-réputation.",
  COMMERCIAL:
    "commercial / apporteur d'affaires — prospection, qualification de leads ENTRANTS, annuaires, recouvrement d'impayés, négociation fournisseurs.",
};

const VALIDATOR_PROMPT = `Tu es un validateur silencieux qui vérifie qu'une réponse d'agent IA respecte ses règles AVANT qu'elle soit envoyée à l'artisan sur WhatsApp.

Tu reçois :
- Le rôle et le nom de l'agent qui a répondu
- Le message courant de l'artisan
- La réponse que l'agent veut envoyer
- Les outils que l'agent a appelés ce tour (très important pour 1)
- L'historique récent

Tu cherches des VIOLATIONS spécifiques :

1. temporal_promise_no_tool : la réponse contient une promesse temporelle ("demain matin", "ce soir", "vendredi", "avant 8h", "dans 2h", "la semaine prochaine", "lundi", "à 17h") MAIS l'agent n'a PAS appelé l'outil scheduleTask ce tour. Sévérité : MAJOR.

2. mention_other_agent : la réponse mentionne spontanément un autre agent (Marie / Lucas / Samir) alors que l'artisan ne l'a PAS évoqué dans son message courant. Ex: agent dit "je transmets à Lucas" sans qu'on lui ait demandé. MAJOR.

3. speak_for_other_agent : la réponse promet ce qu'un autre agent va faire ("Samir te contacte demain", "Lucas s'en occupe avant 17h", "je transmets et Marie te répond avant 8h"). MAJOR.

4. out_of_scope : l'agent répond sur un sujet hors de son périmètre. Marie = devis/factures/emails/planning. Lucas = GMB/réseaux sociaux/SEO/site. Samir = prospection/leads/recouvrement. S'ils sortent de là sans dire honnêtement "ça c'est pour [collègue]", MAJOR. Sinon (s'ils passent la main proprement) : pas de violation.

5. self_flagellation : "Désolée j'ai merdé / j'ai raté / j'ai foiré / c'était nul" en ouverture. MINOR (le programmatic guard les nettoie).

6. markdown_formatting : la réponse contient ## headers, **gras**, listes à puces (- ), ou numérotation 1./2./3. en lignes séparées → ce n'est pas un message WhatsApp. MINOR.

7. too_long : plus de 500 caractères. MINOR.

8. invented_capability : l'agent promet une fonctionnalité qu'il n'a PAS comme tool (ex: "j'envoie un SMS", "je t'appelle", "je téléphone", "je crée une attestation TVA"). MAJOR si engagement clair.

9. invented_data : l'agent invente des chiffres, leads, scrapings, appels d'offres, statistiques, sans avoir appelé un tool qui les a produits ce tour. MAJOR.

Règles de décision :
- Si tu vois UNE violation MAJOR, needs_retry=true.
- Si tu vois UNIQUEMENT des minor, needs_retry=false (le guard les nettoie).
- Si tu ne vois aucune violation, needs_retry=false et violations=[].

Pour correction_hint : 1 phrase courte à la 2e personne ("Réécris sans promettre de date", "Ne mentionne pas Lucas, on ne t'a rien demandé sur lui"), max 200 caractères, français. Vide si pas de retry.

Format de sortie : JSON STRICT, rien autour.
{
  "needs_retry": true|false,
  "violations": [
    { "type": "<type>", "severity": "minor|major", "explanation": "<≤120 chars>" }
  ],
  "correction_hint": "<≤200 chars ou vide>"
}

Exemples :

Réponse : "Ok, je transmets à Samir, il te contacte demain matin avec les leads qualifiés."
→ {"needs_retry":true,"violations":[{"type":"speak_for_other_agent","severity":"major","explanation":"Promet une action de Samir et un délai (demain matin)"},{"type":"temporal_promise_no_tool","severity":"major","explanation":"Promet 'demain matin' sans scheduleTask"},{"type":"invented_data","severity":"major","explanation":"Invente 'leads qualifiés' sans tool"}],"correction_hint":"Réécris sans parler au nom de Samir et sans promettre de délai. Reste sur ton périmètre."}

Réponse : "Devis envoyé. Si tu veux changer la quantité, le prix ou la TVA, dis-le moi et je le régénère."
Outils appelés : generateDevisPDF
→ {"needs_retry":false,"violations":[],"correction_hint":""}

Réponse : "Désolée j'ai merdé. Je corrige ça."
→ {"needs_retry":false,"violations":[{"type":"self_flagellation","severity":"minor","explanation":"Ouverture en auto-flagellation"}],"correction_hint":""}`;

export async function validateAgentReply(input: ValidatorInput): Promise<ValidatorVerdict> {
  // Skip si réponse triviale ou vide
  if (!input.agentReply || input.agentReply.trim().length < 5) {
    return { needs_retry: false, violations: [], correction_hint: '' };
  }

  const userPrompt = [
    `Agent qui a répondu : ${input.agentName} (${ROLE_SUMMARIES[input.agentType]})`,
    input.customInstructions
      ? `Instructions spécifiques tenant : ${input.customInstructions.slice(0, 400)}`
      : '',
    input.contextSnippet ? `Historique récent :\n${input.contextSnippet.slice(0, 1500)}` : '',
    `Outils appelés ce tour : ${
      input.toolCallsMade.length ? input.toolCallsMade.join(', ') : '(aucun)'
    }`,
    `Message actuel de l'artisan :\n"""${input.userMessage.slice(0, 1500)}"""`,
    `Réponse à valider :\n"""${input.agentReply.slice(0, 1500)}"""`,
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    const response = await callLLM({
      taskType: 'reflective.validate',
      systemPrompt: VALIDATOR_PROMPT,
      userPrompt,
      maxTokens: 400,
      temperature: 0,
      responseFormat: 'json',
    });

    const raw = (response.content || '').trim();
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    const obj = JSON.parse(cleaned);

    const violations: Violation[] = Array.isArray(obj.violations)
      ? obj.violations.slice(0, 8).map((v: any) => ({
          type: (v.type || 'other') as ViolationType,
          severity: v.severity === 'major' ? 'major' : 'minor',
          explanation: String(v.explanation || '').slice(0, 200),
        }))
      : [];

    // Sécurité : si le LLM a flag major mais a oublié needs_retry=true, on corrige.
    const hasMajor = violations.some((v) => v.severity === 'major');
    const needsRetry = hasMajor || !!obj.needs_retry;

    return {
      needs_retry: needsRetry,
      violations,
      correction_hint: String(obj.correction_hint || '').slice(0, 300),
      raw: obj,
    };
  } catch (err: any) {
    console.error('[reflective-validator] error:', err?.message || err);
    // En cas d'erreur du validateur, on ne bloque pas le tour : on laisse passer.
    return { needs_retry: false, violations: [], correction_hint: '' };
  }
}
