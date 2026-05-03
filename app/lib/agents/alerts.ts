/**
 * Conversation Alerts — détection automatique des signaux faibles.
 *
 * Après chaque tour de conversation (user message + agent reply), on appelle
 * un Haiku rapide qui classe le tour selon plusieurs catégories :
 *   - frustration : l'artisan exprime du mécontentement
 *   - feature_request : l'artisan demande une fonctionnalité non prévue
 *   - hallucination : l'agent a promis / inventé sans appeler de tool
 *   - repeated_failure : l'artisan répète parce qu'il n'est pas compris
 *   - churn_signal : l'artisan évoque l'arrêt / la résiliation
 *   - confusion : malentendu manifeste
 *   - tool_failure : un outil a échoué techniquement
 *
 * Si la sévérité est med ou high, on persiste l'alerte dans la table
 * `conversation_alerts` et on envoie un email à Faicel via Resend.
 *
 * L'appel est fire-and-forget côté orchestrator : on ne ralentit jamais
 * la réponse à l'artisan.
 */

import { createClient } from '@supabase/supabase-js';
import { callLLM } from '@/lib/agents/llm';
import { sendAdminNotification } from '@/lib/email';
import type { AgentType } from '@/lib/agents/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type AlertType =
  | 'frustration'
  | 'feature_request'
  | 'hallucination'
  | 'repeated_failure'
  | 'churn_signal'
  | 'confusion'
  | 'tool_failure'
  | 'other';

export type AlertSeverity = 'low' | 'med' | 'high';

export interface AlertDetectionInput {
  clientId: string;
  phone: string;
  clientCompany: string;
  agentSignedAs?: AgentType;
  userMessage: string;
  agentReply: string;
  /** Last 3 turns of context, in `Patron: …` / `AgentName: …` format. */
  contextSnippet?: string;
  /** Did any tool call fail in this turn? Allows to flag tool_failure deterministically. */
  toolFailureSummary?: string;
}

const CLASSIFIER_PROMPT = `Tu es un détecteur de signaux faibles dans une conversation WhatsApp entre un artisan BTP et son équipe d'agents IA (Marie, Lucas, Samir).

Pour chaque tour de conversation (message de l'artisan + réponse de l'agent), tu décides si une alerte doit être levée vers Faicel (le fondateur d'iArtisan) pour qu'il puisse intervenir.

## Catégories d'alertes

- frustration : l'artisan exprime du mécontentement, de la colère, de l'agacement ("ça marche pas", "tu fais n'importe quoi", "je perds mon temps")
- feature_request : l'artisan demande une fonctionnalité que les agents ne savent pas faire ("tu peux générer une attestation TVA ?", "tu sais m'envoyer un SMS ?")
- hallucination : l'agent a promis quelque chose ou inventé une action SANS appeler le tool correspondant ("je transmets à Samir demain matin" sans delegate, "je publie le post" sans publishGmbPost, "scraper en maintenance", "leads qualifiés en base")
- repeated_failure : l'artisan a répété la même demande dans le contexte récent parce qu'il n'a pas été compris
- churn_signal : l'artisan parle d'arrêter, de résilier, ou exprime que l'outil ne vaut pas le prix ("j'arrête", "annule mon abonnement", "ça vaut pas le prix", "je vais arrêter")
- confusion : malentendu manifeste, l'agent a complètement raté l'intent
- tool_failure : un outil technique a échoué (sera signalé à part en general)
- other : autre signal qui mérite ton attention

## Sévérité

- high : il faut intervenir VITE (churn, frustration explicite, hallucination grave avec engagement temporel)
- med : à regarder dans la journée (feature request récurrente, confusion, hallucination mineure)
- low : à monitorer mais pas urgent

## Format de sortie

UNIQUEMENT un JSON valide, sans texte autour :
{
  "has_alert": true|false,
  "type": "frustration|feature_request|hallucination|repeated_failure|churn_signal|confusion|tool_failure|other",
  "severity": "low|med|high",
  "reasoning": "<≤200 chars expliquant pourquoi tu as flagué>"
}

Si tout est normal (échange standard sans signal faible), tu retournes {"has_alert":false,"type":"other","severity":"low","reasoning":""}.

## Règles strictes

- Tu ne flagues PAS un échange normal juste parce que l'artisan a dit "merci" ou "ok".
- Tu flagues TOUJOURS l'hallucination si l'agent mentionne "demain matin", "Samir te contacte", "je transmets à X", "scraper", "leads qualifiés", "appels d'offres" SANS contexte légitime de prospection demandée par l'artisan.
- Tu flagues TOUJOURS la frustration explicite ("j'en ai marre", "ça marche pas", "tu fais n'importe quoi", "c'est nul").
- Si tu hésites entre med et high → choisis high. Mieux vaut un faux positif qu'un client qui part.`;

interface ClassifierOutput {
  has_alert: boolean;
  type: AlertType;
  severity: AlertSeverity;
  reasoning: string;
}

async function classifyTurn(input: AlertDetectionInput): Promise<ClassifierOutput | null> {
  const userPrompt = [
    input.contextSnippet ? `Contexte récent :\n${input.contextSnippet}\n` : '',
    `Message de l'artisan :\n"""${input.userMessage.slice(0, 2000)}"""`,
    `Réponse de l'agent (${input.agentSignedAs || 'inconnu'}) :\n"""${input.agentReply.slice(0, 2000)}"""`,
    input.toolFailureSummary ? `\n⚠️ Tool failure dans ce tour : ${input.toolFailureSummary}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    const response = await callLLM({
      taskType: 'alert.detect',
      systemPrompt: CLASSIFIER_PROMPT,
      userPrompt,
      maxTokens: 250,
      temperature: 0,
      responseFormat: 'json',
    });

    const raw = (response.content || '').trim();
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    const obj = JSON.parse(cleaned);

    if (typeof obj.has_alert !== 'boolean') return null;
    return {
      has_alert: !!obj.has_alert,
      type: (obj.type || 'other') as AlertType,
      severity: (obj.severity || 'low') as AlertSeverity,
      reasoning: String(obj.reasoning || '').slice(0, 500),
    };
  } catch (err: any) {
    console.error('[alerts] classifyTurn error:', err?.message || err);
    return null;
  }
}

const ALERT_TYPE_LABEL: Record<AlertType, string> = {
  frustration: '😡 Frustration',
  feature_request: '💡 Feature request',
  hallucination: '🚨 Hallucination',
  repeated_failure: '🔁 Échec répété',
  churn_signal: '🛑 Churn signal',
  confusion: '😵 Confusion',
  tool_failure: '⚙️ Tool failure',
  other: 'ℹ️ Autre',
};

const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  high: '🔴 HIGH',
  med: '🟠 MED',
  low: '🟡 LOW',
};

async function persistAndNotify(
  input: AlertDetectionInput,
  cls: ClassifierOutput
): Promise<void> {
  // Sévérité low → on persiste seulement, pas d'email (sinon spam)
  const shouldNotify = cls.severity === 'high' || cls.severity === 'med';

  const { data, error } = await supabase
    .from('conversation_alerts')
    .insert({
      client_id: input.clientId,
      phone: input.phone,
      alert_type: cls.type,
      severity: cls.severity,
      agent_signed_as: input.agentSignedAs || null,
      user_message: input.userMessage.slice(0, 5000),
      agent_reply: input.agentReply.slice(0, 5000),
      reasoning: cls.reasoning,
      context_snippet: input.contextSnippet?.slice(0, 5000) || null,
      notified_admin: shouldNotify,
      notified_at: shouldNotify ? new Date().toISOString() : null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[alerts] insert error:', error.message);
    return;
  }

  if (!shouldNotify) return;

  // Email à Faicel via Resend
  try {
    await sendAdminNotification(
      `${SEVERITY_LABEL[cls.severity]} ${ALERT_TYPE_LABEL[cls.type]} — ${input.clientCompany}`,
      {
        title: `Alerte conversationnelle ${cls.severity.toUpperCase()}`,
        details: {
          'Client': input.clientCompany,
          'Téléphone': input.phone,
          'Agent': input.agentSignedAs || 'inconnu',
          'Type': ALERT_TYPE_LABEL[cls.type],
          'Sévérité': SEVERITY_LABEL[cls.severity],
          'Pourquoi': cls.reasoning,
          'Message artisan': input.userMessage.slice(0, 400),
          'Réponse agent': input.agentReply.slice(0, 400),
        },
        ctaLabel: 'Voir dans Supabase',
        ctaUrl: 'https://supabase.com/dashboard',
      }
    );
  } catch (err: any) {
    console.error('[alerts] email error:', err?.message || err);
  }
}

/**
 * Point d'entrée — appelé fire-and-forget par l'orchestrator à la fin de chaque tour.
 * Ne throw jamais : toute erreur est logguée mais ne casse pas la réponse à l'artisan.
 */
export async function detectAndLogAlerts(input: AlertDetectionInput): Promise<void> {
  try {
    // Skip si la réponse agent est vide (rien à analyser)
    if (!input.agentReply || input.agentReply.trim().length < 3) return;

    const cls = await classifyTurn(input);
    if (!cls || !cls.has_alert) return;

    await persistAndNotify(input, cls);
  } catch (err: any) {
    console.error('[alerts] detectAndLogAlerts unhandled:', err?.message || err);
  }
}
