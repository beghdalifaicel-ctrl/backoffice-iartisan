/**
 * iArtisan Orchestrator — Tool registry & executors
 *
 * Each agent declares the tools it can call. The orchestrator parses
 * tool-call directives from the LLM output and runs them, posting status
 * updates to WhatsApp as it goes.
 *
 * Tool-call protocol (in agent output):
 *   <tool>
 *   { "name": "tool_name", "args": { ... } }
 *   </tool>
 *
 * The orchestrator extracts every <tool> block, executes them in order,
 * and the agent's text *outside* those blocks becomes the reply to the
 * artisan.
 *
 * Path: lib/agents/tools.ts
 */

import { createClient } from "@supabase/supabase-js";
import type { AgentType } from "@/lib/agents/types";
import {
  handleDevisGeneration,
  editDevisGeneration,
  exportDevisAsFile,
} from "@/lib/pdf/devis-flow";

const supabase = createClient(
  process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
  process.env["SUPABASE_SERVICE_ROLE_KEY"]!
);

// ─── Public types ─────────────────────────────────────────────

export interface ToolCall {
  name: string;
  args: Record<string, any>;
}

export interface ToolResult {
  ok: boolean;
  /** Short, human-readable summary the agent can reuse in its final message. */
  summary: string;
  /** Optional artefact to deliver via WhatsApp (PDF, image, etc.). */
  attachment?: {
    url: string;
    filename: string;
    caption?: string;
  };
  /** Free-form data made available to the agent for follow-up. */
  data?: Record<string, any>;
  /** Error message if ok=false. */
  error?: string;
}

export interface ToolContext {
  clientId: string;
  client: {
    id: string;
    company: string;
    metier: string;
    ville: string;
    firstName?: string;
    plan: string;
  };
  phone: string;            // E.164 raw
  normalizedPhone: string;  // digits only
  /** Stream a status message to the artisan during execution. */
  emitStatus: (text: string) => Promise<void>;
}

export interface ToolDefinition {
  name: string;
  agent: AgentType;
  /** Short description shown to the LLM in the system prompt. */
  description: string;
  /** Arg schema as plain English (the LLM doesn't need formal JSON Schema for this). */
  argsHint: string;
  exec: (args: Record<string, any>, ctx: ToolContext) => Promise<ToolResult>;
}

// ─── Tool registry ────────────────────────────────────────────

export const TOOLS: ToolDefinition[] = [
  // ============== ADMIN (Marie) ==============
  {
    name: "generateDevisFromText",
    agent: "ADMIN",
    description:
      "Génère un devis PDF à partir d'une description en texte. À utiliser dès que l'artisan demande un devis et a fourni au moins le type de prestation. PJ envoyée automatiquement à l'artisan. APRÈS l'envoi, propose TOUJOURS la modification (le système ajoute le numéro du devis dans data, à reprendre dans ta réponse).",
    argsHint:
      '{ "client_name": "Mme Dupont", "client_address"?: "...", "client_email"?: "...", "description": "ravalement 80m² enduit minéral" }',
    exec: async (args, ctx) => {
      // Si l'artisan n'a pas donné de nom de client, on demande au lieu d'inventer
      // un "Client {timestamp}" laid sur le PDF.
      if (!args.client_name || !String(args.client_name).trim()) {
        return {
          ok: false,
          summary: "nom client manquant — demande à l'artisan",
          error: "missing_client_name",
          data: {
            clarification_needed:
              "Pour qui je fais ce devis ? Donne-moi le nom du client (ex: Mme Dupont, M. Martin).",
          },
        };
      }

      await ctx.emitStatus("Je te prépare le devis…");
      try {
        const r = await handleDevisGeneration({
          clientId: ctx.clientId,
          clientName: String(args.client_name).trim(),
          clientAddress: args.client_address,
          clientEmail: args.client_email,
          userPhone: ctx.normalizedPhone,
          userMessage: args.description || "",
        });
        // Cas spécifique : extraction LLM a remonté une demande de clarification
        // (description trop vague) — on transmet le message à Marie pour qu'elle
        // pose la question, sans tenter de générer un PDF foireux.
        if (!r.success && r.error === "needs_clarification") {
          return {
            ok: false,
            summary: "demande trop vague — demande clarification à l'artisan",
            error: "needs_clarification",
            data: { clarification_needed: r.message },
          };
        }
        if (r.success && r.documentUrl) {
          return {
            ok: true,
            summary: `Devis ${r.devisNumber} prêt — propose la modification dans ta réponse`,
            attachment: {
              url: r.documentUrl,
              filename: r.devisNumber || "devis.pdf",
              caption: `Devis ${r.devisNumber}`,
            },
            data: {
              devis_number: r.devisNumber,
              version: r.version || 1,
              document_url: r.documentUrl,
              proactivity_hint:
                "Termine ta réponse en proposant explicitement la modification : « Si tu veux changer quelque chose (quantité, prix, désignation, ajouter/retirer une ligne, modifier la TVA…), dis-le moi simplement et je te renvoie le devis modifié. »",
            },
          };
        }
        return { ok: false, summary: "génération devis échouée", error: r.error || "unknown" };
      } catch (e: any) {
        return { ok: false, summary: "erreur devis", error: e?.message || String(e) };
      }
    },
  },

  {
    name: "exportDevisToWord",
    agent: "ADMIN",
    description:
      "Exporte un devis EXISTANT au format Word (.docx) modifiable, à utiliser quand l'artisan demande de finaliser le devis dans son outil ou personnaliser la mise en page (ex: 'envoie-moi en Word', 'tu peux me filer un docx ?', 'format modifiable Word'). " +
      "Si l'artisan mentionne un numéro précis (DEV-AAAA-XXXX), passer dans devis_number ; sinon laisser vide pour exporter le DERNIER devis envoyé. PJ envoyée automatiquement.",
    argsHint: '{ "devis_number"?: "DEV-2026-0042" }',
    exec: async (args, ctx) => {
      await ctx.emitStatus("Je te prépare le devis en Word…");
      try {
        const r = await exportDevisAsFile({
          clientId: ctx.clientId,
          userPhone: ctx.normalizedPhone,
          devisNumber: args.devis_number,
          format: "docx",
        });
        if (r.success && r.documentUrl) {
          return {
            ok: true,
            summary: `Devis ${r.devisNumber} exporté en Word`,
            attachment: {
              url: r.documentUrl,
              filename: r.filename || `${r.devisNumber}.docx`,
              caption: `Devis ${r.devisNumber} — Word`,
            },
            data: { devis_number: r.devisNumber, format: "docx" },
          };
        }
        return { ok: false, summary: "export Word échoué", error: r.message || r.error || "unknown" };
      } catch (e: any) {
        return { ok: false, summary: "erreur export Word", error: e?.message || String(e) };
      }
    },
  },

  {
    name: "exportDevisToExcel",
    agent: "ADMIN",
    description:
      "Exporte un devis EXISTANT au format Excel (.xlsx) modifiable, à utiliser quand l'artisan veut bricoler les prix dans un tableur ou réutiliser les chiffres dans son outil (ex: 'envoie-moi en Excel', 'tu peux me filer un xlsx ?', 'tableur', 'format modifiable Excel'). " +
      "Si l'artisan mentionne un numéro précis (DEV-AAAA-XXXX), passer dans devis_number ; sinon laisser vide pour exporter le DERNIER devis envoyé. PJ envoyée automatiquement.",
    argsHint: '{ "devis_number"?: "DEV-2026-0042" }',
    exec: async (args, ctx) => {
      await ctx.emitStatus("Je te prépare le devis en Excel…");
      try {
        const r = await exportDevisAsFile({
          clientId: ctx.clientId,
          userPhone: ctx.normalizedPhone,
          devisNumber: args.devis_number,
          format: "xlsx",
        });
        if (r.success && r.documentUrl) {
          return {
            ok: true,
            summary: `Devis ${r.devisNumber} exporté en Excel`,
            attachment: {
              url: r.documentUrl,
              filename: r.filename || `${r.devisNumber}.xlsx`,
              caption: `Devis ${r.devisNumber} — Excel`,
            },
            data: { devis_number: r.devisNumber, format: "xlsx" },
          };
        }
        return { ok: false, summary: "export Excel échoué", error: r.message || r.error || "unknown" };
      } catch (e: any) {
        return { ok: false, summary: "erreur export Excel", error: e?.message || String(e) };
      }
    },
  },

  {
    name: "editDevis",
    agent: "ADMIN",
    description:
      "Modifie un devis EXISTANT déjà envoyé à l'artisan. À utiliser quand l'artisan demande un changement (quantité, prix, désignation, ajout/retrait de ligne, modification TVA, conditions de paiement). " +
      "Si l'artisan mentionne un numéro précis (DEV-AAAA-XXXX), le passer dans devis_number ; sinon laisser vide pour modifier le DERNIER devis envoyé. " +
      "Les modifications sont en langage naturel — tu reformules brut ce que l'artisan a dit. PJ régénérée et envoyée automatiquement.",
    argsHint:
      '{ "devis_number"?: "DEV-2026-0042", "modifications": "passe la quantité de carrelage à 30m² et ajoute une ligne pour le débarras 200€" }',
    exec: async (args, ctx) => {
      await ctx.emitStatus("Je modifie le devis…");
      try {
        const r = await editDevisGeneration({
          clientId: ctx.clientId,
          userPhone: ctx.normalizedPhone,
          devisNumber: args.devis_number,
          modifications: args.modifications || "",
        });
        if (r.success && r.documentUrl) {
          return {
            ok: true,
            summary: `Devis ${r.devisNumber} modifié (v${r.version})`,
            attachment: {
              url: r.documentUrl,
              filename: `${r.devisNumber}-v${r.version}.pdf`,
              caption: `Devis ${r.devisNumber} (v${r.version})`,
            },
            data: {
              devis_number: r.devisNumber,
              version: r.version,
              document_url: r.documentUrl,
              proactivity_hint:
                "Termine ta réponse en proposant à nouveau la modification : « Encore d'autres changements à faire ? Dis-le moi, je relance. »",
            },
          };
        }
        return { ok: false, summary: "modification devis échouée", error: r.error || "unknown" };
      } catch (e: any) {
        return { ok: false, summary: "erreur édition devis", error: e?.message || String(e) };
      }
    },
  },

  {
    name: "scheduleTask",
    agent: "ADMIN",
    description:
      "Programme une action future (relance, publication, rappel). OBLIGATOIRE avant toute promesse de type 'demain', 'vendredi', 'la semaine prochaine'. La tâche sera exécutée par le worker au moment voulu.",
    argsHint:
      '{ "agent": "ADMIN|MARKETING|COMMERCIAL", "intent": "payment_reminder|post_gmb|...", "scheduled_at_iso": "2026-05-02T08:30:00+02:00", "payload": { ... }, "notify_on_complete": true }',
    exec: async (args, ctx) => {
      try {
        const { data, error } = await supabase
          .from("agent_tasks")
          .insert({
            client_id: ctx.clientId,
            agent_type: args.agent || "ADMIN",
            task_type: args.intent || "generic",
            scheduled_for: args.scheduled_at_iso || new Date().toISOString(),
            payload: args.payload || {},
            notify_phone: args.notify_on_complete === false ? null : ctx.phone,
          })
          .select("id, scheduled_for")
          .single();
        if (error) throw error;
        return {
          ok: true,
          summary: `Programmé pour ${new Date(data!.scheduled_for).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}`,
          data: { task_id: data!.id },
        };
      } catch (e: any) {
        return { ok: false, summary: "impossible de programmer", error: e?.message || String(e) };
      }
    },
  },

  {
    name: "sendPaymentReminder",
    agent: "ADMIN",
    description:
      "Envoie une relance de paiement à un client final (email). Génère un message poli, professionnel, avec montant et nº de facture.",
    argsHint:
      '{ "client_email": "x@y.fr", "client_name": "Dupont", "invoice_number": "F-2026-018", "amount_eur": 850, "tone": "polie|ferme" }',
    exec: async (args, ctx) => {
      await ctx.emitStatus(`Je rédige la relance pour ${args.client_name || "le client"}…`);
      // Intégration avec Brevo / SMTP côté backoffice. Stub safe par défaut :
      // on enregistre l'intention en agent_tasks pour traitement par le worker.
      const { data, error } = await supabase
        .from("agent_tasks")
        .insert({
          client_id: ctx.clientId,
          agent_type: "ADMIN",
          task_type: "payment_reminder_send",
          scheduled_for: new Date().toISOString(),
          payload: args,
          notify_phone: ctx.phone,
        })
        .select("id")
        .single();
      if (error) return { ok: false, summary: "relance non envoyée", error: error.message };
      return {
        ok: true,
        summary: `Relance ${args.invoice_number || ""} programmée pour envoi`,
        data: { task_id: data!.id },
      };
    },
  },

  {
    name: "summarizeInbox",
    agent: "ADMIN",
    description:
      "[NON DISPONIBLE — n'utilise PAS ce tool] Résume les emails non lus. L'intégration Gmail/IMAP n'est PAS branchée. Si l'artisan demande de résumer sa boîte, dis-lui honnêtement que tu n'as pas accès à ses emails et propose-lui de te transférer manuellement les messages importants.",
    argsHint: '{ "since_hours": 24 }',
    exec: async (_args, _ctx) => {
      // Tool désactivé : sans accès Gmail réel, retourner ok:true + counts à 0
      // ferait halluciner Marie ("ta boîte est calme aujourd'hui"). On force
      // la transparence.
      return {
        ok: false,
        summary:
          "Accès à la boîte mail NON branché. Dis honnêtement à l'artisan : 'Je n'ai pas encore accès à ta boîte mail directement. Si tu veux, transfère-moi les emails importants et je te les résume / prépare une réponse.'",
        error: "tool_not_implemented",
      };
    },
  },

  // ============== MARKETING (Lucas) ==============
  {
    name: "publishGmbPost",
    agent: "MARKETING",
    description:
      "Publie un post sur Google Business Profile. Si scheduled_at_iso est fourni, programme via scheduleTask.",
    argsHint:
      '{ "title": "Nouvelle réalisation", "body": "...", "cta_url"?: "https://...", "scheduled_at_iso"?: "..." }',
    exec: async (args, ctx) => {
      const when = args.scheduled_at_iso || new Date().toISOString();
      const { data, error } = await supabase
        .from("agent_tasks")
        .insert({
          client_id: ctx.clientId,
          agent_type: "MARKETING",
          task_type: "gmb_post",
          scheduled_for: when,
          payload: args,
          notify_phone: ctx.phone,
        })
        .select("id, scheduled_for")
        .single();
      if (error) return { ok: false, summary: "post GMB non programmé", error: error.message };
      const isFuture = new Date(when).getTime() > Date.now() + 60_000;
      return {
        ok: true,
        summary: isFuture
          ? `Post GMB programmé (${new Date(when).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })})`
          : "Post GMB en file d'attente (publication imminente)",
        data: { task_id: data!.id },
      };
    },
  },

  {
    name: "replyToReview",
    agent: "MARKETING",
    description:
      "Rédige et publie une réponse à un avis Google. Ton calé sur la note (apaisant si 1-2 étoiles, chaleureux si 4-5). Demande validation à l'artisan SAUF si pre_approved=true.",
    argsHint:
      '{ "review_id": "...", "rating": 1, "review_text": "...", "tone": "apaisant|chaleureux|neutre", "pre_approved"?: false }',
    exec: async (args, ctx) => {
      const { data, error } = await supabase
        .from("agent_tasks")
        .insert({
          client_id: ctx.clientId,
          agent_type: "MARKETING",
          task_type: args.pre_approved ? "review_reply_publish" : "review_reply_draft",
          scheduled_for: new Date().toISOString(),
          payload: args,
          notify_phone: ctx.phone,
        })
        .select("id")
        .single();
      if (error) return { ok: false, summary: "réponse avis non préparée", error: error.message };
      return {
        ok: true,
        summary: args.pre_approved
          ? "Réponse à l'avis en cours de publication"
          : `Brouillon de réponse à l'avis (${args.rating}★) prêt — validation requise`,
        data: { task_id: data!.id },
      };
    },
  },

  {
    name: "fetchRecentReviews",
    agent: "MARKETING",
    description:
      "[NON DISPONIBLE — n'utilise PAS ce tool] Récupère les avis Google récents. L'intégration GMB Reviews API n'est PAS branchée (en cours de validation Google). Si l'artisan demande à voir / répondre à ses avis, dis-lui honnêtement que la connexion GMB est en cours et propose-lui de te coller les avis pour préparer des réponses.",
    argsHint: '{ "since_days": 30 }',
    exec: async (_args, _ctx) => {
      // Tool désactivé : sans GMB API, retourner reviews:[] ferait dire à Lucas
      // "tu n'as pas de nouveaux avis" — c'est faux car on n'en sait rien.
      return {
        ok: false,
        summary:
          "Connexion GMB Reviews NON branchée (en cours de validation Google). Dis honnêtement à l'artisan : 'Je n'ai pas encore l'accès direct à tes avis Google. Si tu me colles le texte d'un avis (ou un screenshot), je te prépare une réponse calée sur la note.'",
        error: "tool_not_implemented",
      };
    },
  },

  // ============== COMMERCIAL (Samir) ==============
  {
    name: "qualifyLead",
    agent: "COMMERCIAL",
    description:
      "Qualifie un prospect : enrichit les infos (entreprise, métier, ville, taille), score le fit avec l'artisan, propose la prochaine action.",
    argsHint:
      '{ "lead_name": "...", "lead_phone"?: "...", "lead_email"?: "...", "source"?: "habitatpresto|appel_entrant|..." }',
    exec: async (_args, _ctx) => {
      // Tool désactivé tant que l'enrichissement Apollo/Pappers n'est pas
      // branché. Sans intégration réelle, le LLM derrière invente un score
      // ("score 8/10", "fit fort") pour combler le data vide. On retourne
      // explicitement un échec pour forcer Samir à dire honnêtement qu'il
      // n'a pas encore l'outil de qualification automatique.
      return {
        ok: false,
        summary:
          "Outil de qualification automatique non branché. Dis honnêtement à l'artisan : 'Je n'ai pas encore l'outil pour qualifier automatiquement. Donne-moi les coordonnées et le contexte du lead, je peux te proposer une réponse manuelle.'",
        error: "tool_not_implemented",
      };
    },
  },

  {
    name: "scrapeAnnuaires",
    agent: "COMMERCIAL",
    description:
      "[NON DISPONIBLE — n'utilise PAS ce tool] Cherche des chantiers/leads sur les annuaires. L'intégration n'est PAS branchée. Si l'artisan demande de prospecter, dis-lui honnêtement que le scraper n'est pas encore disponible et propose une alternative concrète (rédiger un email à une liste qu'il fournit, qualifier un lead entrant, etc.).",
    argsHint: '{ "metier": "...", "zone": "...", "period": "..." }',
    exec: async (_args, _ctx) => {
      // Tool désactivé : sans scraper réel, retourner ok:true + hits:[] fait
      // halluciner le LLM ("scraper en maintenance", "0 lead pour l'instant").
      // On retourne ok:false avec un message qui pousse à la vérité.
      return {
        ok: false,
        summary:
          "Scraper d'annuaires NON branché. Dis honnêtement à l'artisan : 'Je n'ai pas encore l'outil pour scraper Habitatpresto ou les marchés publics directement. Pour l'instant je peux : (1) qualifier les leads que tu m'envoies, (2) rédiger des emails de prospection si tu me donnes une liste, (3) suivre tes impayés. Lequel t'aiderait maintenant ?'",
        error: "tool_not_implemented",
      };
    },
  },

  {
    name: "dunningStep",
    agent: "COMMERCIAL",
    description:
      "Passe un impayé à l'étape suivante du process de recouvrement (relance simple → mise en demeure → contentieux). Programme l'action en tâche.",
    argsHint:
      '{ "invoice_number": "F-2026-...", "client_name": "...", "amount_eur": 0, "current_step": "relance_simple|mise_en_demeure|contentieux" }',
    exec: async (args, ctx) => {
      const next =
        args.current_step === "relance_simple"
          ? "mise_en_demeure"
          : args.current_step === "mise_en_demeure"
            ? "contentieux"
            : "relance_simple";
      const { data, error } = await supabase
        .from("agent_tasks")
        .insert({
          client_id: ctx.clientId,
          agent_type: "COMMERCIAL",
          task_type: "dunning_step",
          scheduled_for: new Date().toISOString(),
          payload: { ...args, next_step: next },
          notify_phone: ctx.phone,
        })
        .select("id")
        .single();
      if (error) return { ok: false, summary: "étape recouvrement non programmée", error: error.message };
      return {
        ok: true,
        summary: `Recouvrement → ${next} (${args.invoice_number || "facture"})`,
        data: { task_id: data!.id, next_step: next },
      };
    },
  },

  // ============== Cross-agent ==============
  {
    name: "delegate",
    agent: "ADMIN", // Marie peut déléguer ; Lucas/Samir peuvent en théorie aussi (inversion gérée côté orchestrateur).
    description:
      "Demande à un collègue (autre agent) de fournir une info ou d'exécuter sa partie d'une tâche cross-domain. À utiliser pour 'résume ma semaine' ou toute requête qui touche plusieurs périmètres.",
    argsHint: '{ "to_agent": "MARKETING|COMMERCIAL|ADMIN", "ask": "..." }',
    exec: async (args, ctx) => {
      // L'exécution réelle de la délégation est gérée par l'orchestrateur
      // (qui re-route vers le second agent). Ici on enregistre juste l'intention.
      return {
        ok: true,
        summary: `→ ${args.to_agent}`,
        data: { delegate_to: args.to_agent, ask: args.ask },
      };
    },
  },
];

// ─── Helpers ─────────────────────────────────────────────────

export function toolsForAgent(agent: AgentType): ToolDefinition[] {
  // delegate is available to all agents (we relabel its `agent` for prompt purposes)
  const own = TOOLS.filter((t) => t.agent === agent && t.name !== "delegate");
  const delegateTool = TOOLS.find((t) => t.name === "delegate")!;
  return [...own, delegateTool];
}

export function findTool(name: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.name === name);
}

/**
 * Parse `<tool>{...}</tool>` blocks from agent output.
 * Returns the list of calls AND the cleaned reply text.
 */
export function parseToolCalls(raw: string): {
  calls: ToolCall[];
  cleanedText: string;
} {
  const calls: ToolCall[] = [];
  const re = /<tool>\s*([\s\S]*?)\s*<\/tool>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const body = m[1].trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
    try {
      const obj = JSON.parse(body);
      if (obj && typeof obj.name === "string") {
        calls.push({ name: obj.name, args: obj.args || {} });
      }
    } catch {
      // ignore malformed tool block
    }
  }
  const cleanedText = raw.replace(re, "").replace(/\n{3,}/g, "\n\n").trim();
  return { calls, cleanedText };
}

/** Render the tools section of an agent's system prompt. */
export function renderToolsForPrompt(agent: AgentType): string {
  const list = toolsForAgent(agent);
  const lines = list.map((t) => `- ${t.name} — ${t.description}\n  args: ${t.argsHint}`);
  return lines.join("\n");
}
