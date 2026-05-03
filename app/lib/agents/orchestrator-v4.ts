/**
 * iArtisan Orchestrator — main loop
 *
 * Pipeline per inbound WhatsApp message :
 *   1. Load shared chat history (no agent_type silo).
 *   2. Route to a single agent (LLM classifier).
 *   3. Build action-first system prompt with tools listed.
 *   4. Call the agent. Parse <tool> blocks from output.
 *   5. Execute tool calls one by one, emitting status updates between calls.
 *   6. If tools ran, call agent again with results to produce the final reply.
 *   7. Persist message + log (single shared history).
 *
 * If router says cross_domain=true, after the primary agent finishes we may
 * re-enter the loop once for a second agent that signs explicitly.
 *
 * Path: lib/agents/orchestrator.ts
 */

import { createClient } from "@supabase/supabase-js";
import { callLLM } from "@/lib/agents/llm";
import type { AgentType, PlanType } from "@/lib/agents/types";
import { DEFAULT_AGENT_NAMES, PLAN_AGENTS } from "@/lib/agents/types";
import { routeMessage, type RouterDecision } from "@/lib/agents/router-v4";
import {
  parseToolCalls,
  findTool,
  type ToolCall,
  type ToolContext,
  type ToolResult,
} from "@/lib/agents/tools-v4";
import { buildAgentSystemPrompt, buildToolResultFollowup } from "@/lib/agents/prompts-v4";
import { detectAndLogAlerts } from "@/lib/agents/alerts";
import { validateAgentReply, type ValidatorVerdict } from "@/lib/agents/reflective-validator";

const supabase = createClient(
  process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
  process.env["SUPABASE_SERVICE_ROLE_KEY"]!
);

export const AGENT_EMOJIS: Record<AgentType, string> = {
  ADMIN: "🟣",
  MARKETING: "🟢",
  COMMERCIAL: "🔴",
};

// ─── Types ─────────────────────────────────────────────────

export interface OrchestratorInput {
  client: {
    id: string;
    plan: PlanType;
    company: string;
    metier: string;
    ville: string;
    firstName?: string;
    lastName?: string;
  };
  phone: string;            // E.164 raw (with +)
  normalizedPhone: string;  // digits only
  text: string;
  /** Optional explicit agent (e.g. /marie /lucas /samir). Skips routing. */
  forceAgent?: AgentType;
  /** Send-message hook plugged by the webhook (Meta Cloud API in prod). */
  sendMessage: (toPhone: string, text: string) => Promise<void>;
  sendDocument: (
    toPhone: string,
    documentUrl: string,
    filename: string,
    caption?: string
  ) => Promise<void>;
}

export interface OrchestratorOutcome {
  routedTo: AgentType;
  intent: string;
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  finalReply: string;
  artefactDelivered: boolean;
  durationMs: number;
}

// ─── History (unified) ────────────────────────────────────

async function getSharedHistory(
  clientId: string,
  phone: string,
  limit = 12
): Promise<{ role: string; content: string; agent_signed_as?: string }[]> {
  const { data } = await supabase
    .from("chat_history")
    .select("role, content, agent_signed_as")
    .eq("client_id", clientId)
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data || []).reverse();
}

async function saveMessage(
  clientId: string,
  phone: string,
  role: "user" | "assistant",
  content: string,
  agentSignedAs?: AgentType
): Promise<void> {
  await supabase.from("chat_history").insert({
    client_id: clientId,
    channel: "whatsapp",
    phone,
    role,
    content: content.substring(0, 5000),
    agent_signed_as: agentSignedAs || null,
  });
}

function historyToSnippet(
  history: { role: string; content: string; agent_signed_as?: string }[],
  maxTurns = 3
): string {
  return history
    .slice(-maxTurns * 2)
    .map((m) =>
      m.role === "user"
        ? `Patron: ${m.content}`
        : `${m.agent_signed_as ? DEFAULT_AGENT_NAMES[m.agent_signed_as as AgentType] : "Agent"}: ${m.content}`
    )
    .join("\n");
}

// ─── Agent display name (per-tenant override) ─────────────

async function getAgentDisplayName(clientId: string, type: AgentType): Promise<string> {
  const { data } = await supabase
    .from("agent_configs")
    .select("display_name")
    .eq("client_id", clientId)
    .eq("agent_type", type)
    .single();
  return data?.display_name || DEFAULT_AGENT_NAMES[type];
}

async function getCustomInstructions(clientId: string, type: AgentType): Promise<string | undefined> {
  const { data } = await supabase
    .from("agent_configs")
    .select("instructions")
    .eq("client_id", clientId)
    .eq("agent_type", type)
    .single();
  return data?.instructions || undefined;
}

// ─── Main entry ────────────────────────────────────────────

export async function orchestrate(input: OrchestratorInput): Promise<OrchestratorOutcome> {
  const t0 = Date.now();
  const { client, phone, normalizedPhone, text, sendMessage, sendDocument } = input;

  // 1) Save the inbound user message in the shared history immediately
  await saveMessage(client.id, normalizedPhone, "user", text);

  // 2) Load context
  const history = await getSharedHistory(client.id, normalizedPhone, 12);
  const historySnippet = historyToSnippet(history.slice(0, -1), 3); // exclude the message we just saved

  const teamAgents = PLAN_AGENTS[client.plan] as AgentType[];
  const teamMembers = await Promise.all(
    teamAgents.map(async (t) => ({ type: t, name: await getAgentDisplayName(client.id, t) }))
  );
  const isTeam = teamMembers.length > 1;

  // 3) Routing
  // On extrait le dernier agent qui a parlé (assistant message le plus récent)
  // pour que le router puisse appliquer son short-circuit de continuité.
  // history est trié ascendant (plus ancien → plus récent), on cherche en
  // partant de la fin (sans inclure le user message qu'on vient de saver).
  let lastAssistantAgent: AgentType | undefined;
  for (let i = history.length - 2; i >= 0; i--) {
    const m = history[i];
    if (m.role === "assistant" && m.agent_signed_as) {
      const sig = m.agent_signed_as as AgentType;
      if (["ADMIN", "MARKETING", "COMMERCIAL"].includes(sig)) {
        lastAssistantAgent = sig;
        break;
      }
    }
  }

  let decision: RouterDecision;
  if (input.forceAgent && teamAgents.includes(input.forceAgent)) {
    decision = {
      target_agent: input.forceAgent,
      intent: "unknown",
      needs_artifact: false,
      cross_domain: false,
      confidence: 1,
      reason: "force_agent",
    };
  } else {
    decision = await routeMessage({
      text,
      availableAgents: teamAgents,
      recentHistorySnippet: historySnippet,
      lastAssistantAgent,
    });
  }

  const target = decision.target_agent;
  const agentName = teamMembers.find((m) => m.type === target)!.name;

  // 4) Build prompt + first agent call
  const systemPrompt = buildAgentSystemPrompt({
    client,
    agentName,
    agentType: target,
    teamMembers,
    customInstructions: await getCustomInstructions(client.id, target),
  });

  const conversationContext = history
    .slice(-6) // last 3 turns
    .map((m) =>
      m.role === "user"
        ? { role: "user" as const, content: m.content }
        : { role: "assistant" as const, content: m.content }
    );

  const userPromptForAgent = [
    historySnippet ? `Historique récent :\n${historySnippet}\n` : "",
    `Message actuel de l'artisan :\n${text}`,
  ]
    .filter(Boolean)
    .join("\n");

  // Helper: build the WhatsApp prefix used when team has > 1 member
  const prefixFor = (t: AgentType, name: string) =>
    isTeam ? `${AGENT_EMOJIS[t]} ${name} :\n` : "";

  // Status emitter for tools
  const emitStatus = async (statusText: string) => {
    const prefix = prefixFor(target, agentName);
    await sendMessage(phone, prefix + statusText);
  };

  const toolCtx: ToolContext = {
    clientId: client.id,
    client: { ...client },
    phone,
    normalizedPhone,
    emitStatus,
  };

  // 5) First LLM pass — agent thinks + may emit tool calls
  const firstPass = await callLLM({
    taskType: "agent.act",
    systemPrompt,
    userPrompt: userPromptForAgent,
    maxTokens: 600,
    temperature: 0.5,
  });

  let { calls: toolCalls, cleanedText: replyDraft } = parseToolCalls(firstPass.content || "");

  // 6) Execute tools sequentially with status updates
  const toolResults: ToolResult[] = [];
  let artefactDelivered = false;
  let pendingDelegateTo: AgentType | null = null;
  let pendingDelegateAsk: string | null = null;

  for (const call of toolCalls) {
    const def = findTool(call.name);
    if (!def) {
      toolResults.push({ ok: false, summary: `tool inconnu: ${call.name}`, error: "unknown_tool" });
      continue;
    }
    const t1 = Date.now();
    let result: ToolResult;
    try {
      result = await def.exec(call.args, toolCtx);
    } catch (e: any) {
      result = { ok: false, summary: `erreur ${call.name}`, error: e?.message || String(e) };
    }
    const ms = Date.now() - t1;

    toolResults.push(result);

    // Special handling: delegate tool sets up a follow-up agent run
    if (call.name === "delegate" && result.ok && result.data?.delegate_to) {
      pendingDelegateTo = result.data.delegate_to as AgentType;
      pendingDelegateAsk = result.data.ask || null;
    }

    // Deliver attachment immediately if any
    if (result.ok && result.attachment) {
      await sendDocument(
        phone,
        result.attachment.url,
        result.attachment.filename,
        prefixFor(target, agentName) + (result.attachment.caption || "")
      );
      artefactDelivered = true;
    }

    await supabase.from("agent_logs").insert({
      client_id: client.id,
      agent_type: target,
      action: `tool.${call.name}`,
      tokens_used: 0,
      model_used: "tool",
      duration_ms: ms,
      cost_cents: 0,
      metadata: { call_args: call.args, ok: result.ok, summary: result.summary },
    });
  }

  // 7) If tools ran, second LLM pass to produce the final reply with results
  let finalReply = replyDraft;
  if (toolCalls.length > 0) {
    const followup = buildToolResultFollowup(
      toolResults.map((r, i) => ({
        name: toolCalls[i].name,
        ok: r.ok,
        summary: r.summary,
        data: r.data,
        error: r.error,
      }))
    );
    const secondPass = await callLLM({
      taskType: "agent.summarize",
      systemPrompt,
      userPrompt: `${userPromptForAgent}\n\n${followup}`,
      maxTokens: 300,
      temperature: 0.5,
    });
    // Strip any new tool blocks from the second pass to avoid loops
    finalReply = parseToolCalls(secondPass.content || "").cleanedText || replyDraft;
  }

  if (!finalReply.trim()) {
    finalReply = "OK — j'ai bien reçu, je reviens vers toi avec une suite concrète.";
  }

  // 7.5) Garde-fou anti-promesse temporelle creuse
  //
  // Les agents (surtout Marie face à de la frustration) ont tendance à promettre
  // "je corrige ça demain matin avant 8h" sans appeler scheduleTask — exactement
  // l'hallucination qu'on veut éliminer. Le prompt système le dit explicitement,
  // mais le LLM dérape encore. Ce garde programmatique attrape les patterns
  // résiduels et nettoie la réponse.
  const hasScheduleTaskCall = toolCalls.some((c) => c.name === "scheduleTask");
  if (!hasScheduleTaskCall) {
    const TEMPORAL_PROMISE_PATTERNS = [
      // "demain matin", "demain soir", "demain à 8h"
      /\b(demain|cette\s?nuit|ce\s?soir|cet\s?après-?midi)\s+(matin|soir|midi|à\s?\d{1,2}h(?:\d{2})?|avant\s?\d{1,2}h(?:\d{2})?)?\b/gi,
      // "avant 8h", "d'ici 17h", "avant la fin de la journée"
      /\b(avant|d['’]ici)\s+(\d{1,2}h(?:\d{2})?|midi|la\s?fin\s?de\s?(?:la\s?)?journée)\b/gi,
      // "vendredi", "lundi", "la semaine prochaine"
      /\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|la\s?semaine\s?prochaine)\b/gi,
      // "dans X minutes/heures/jours"
      /\bdans\s+\d+\s+(minutes?|heures?|jours?|semaines?)\b/gi,
    ];

    let cleanedReply = finalReply;
    let removedCount = 0;
    for (const re of TEMPORAL_PROMISE_PATTERNS) {
      // Pour chaque phrase qui contient un de ces patterns, on la retire entière
      // (split par phrase = "; ", ". ", "! ", "? ").
      const sentences = cleanedReply.split(/(?<=[.!?])\s+/);
      const kept = sentences.filter((s) => {
        if (re.test(s)) {
          removedCount++;
          return false;
        }
        return true;
      });
      cleanedReply = kept.join(" ");
    }

    if (removedCount > 0 && cleanedReply.trim() !== finalReply.trim()) {
      console.warn(
        `[orchestrator] Removed ${removedCount} temporal promise sentence(s) from agent ${target} (no scheduleTask call). Original: "${finalReply.slice(0, 200)}"`
      );
      finalReply = cleanedReply.trim() ||
        "OK, dis-moi exactement ce qu'il faut corriger et je le fais maintenant.";
    }
  }

  // Garde-fou anti-auto-flagellation excessive : "Désolée j'ai merdé" et
  // variants ne sont pas un comportement d'agent professionnel. On nettoie
  // les ouvertures d'auto-flagellation tout en gardant le reste utile.
  finalReply = finalReply.replace(
    /^(Désolée?,?\s+(j['’]?ai\s+merdé|j['’]?ai\s+merdoyé|j['’]?ai\s+raté|j['’]?ai\s+foiré|c['’]?était\s+nul)[.!?]?\s*)/i,
    ""
  ).trim();
  if (!finalReply) {
    finalReply = "Dis-moi exactement ce qu'il faut corriger et je m'en occupe.";
  }

  // 7.7) Reflective validator — auto-correction temps réel
  //
  // Avant d'envoyer la réponse à l'artisan, un LLM réflexif relit le tour
  // pour attraper les violations sémantiques que les regex ne voient pas
  // (mention spontanée d'agent, sortie de périmètre, ton inadapté,
  // promesses au nom d'autres agents, etc.).
  //
  // Si une violation MAJEURE est détectée, on relance l'agent UNE fois avec
  // un prompt de correction. Le retry est persisté dans agent_retries pour
  // observabilité. Limité à 1 retry max pour borner le coût et la latence.
  const replyBeforeReflexive = finalReply;
  const customInstructionsForRetry = await getCustomInstructions(client.id, target);
  let validatorVerdict: ValidatorVerdict | null = null;
  try {
    validatorVerdict = await validateAgentReply({
      agentType: target,
      agentName,
      userMessage: text,
      agentReply: finalReply,
      contextSnippet: historySnippet || undefined,
      toolCallsMade: toolCalls.map((c) => c.name),
      customInstructions: customInstructionsForRetry,
    });
  } catch (err: any) {
    console.error("[orchestrator] reflective validator threw:", err?.message || err);
  }

  if (validatorVerdict?.needs_retry && validatorVerdict.correction_hint) {
    console.warn(
      `[orchestrator] Reflective retry for ${target} | violations=${validatorVerdict.violations
        .map((v) => `${v.type}(${v.severity})`)
        .join(",")} | hint="${validatorVerdict.correction_hint}"`
    );

    const retryPrompt = [
      userPromptForAgent,
      "",
      `Ta première réponse contenait des problèmes :`,
      ...validatorVerdict.violations
        .filter((v) => v.severity === "major")
        .map((v) => `- ${v.type} : ${v.explanation}`),
      "",
      `Correction demandée : ${validatorVerdict.correction_hint}`,
      "",
      `Réécris ta réponse en respectant strictement ces corrections. Pas de Markdown, 2-3 phrases max, ne mentionne PAS d'autre agent si tu n'y es pas obligé, et N'ENGAGE PAS de date/délai si tu n'as pas appelé scheduleTask.`,
    ].join("\n");

    try {
      const retryPass = await callLLM({
        taskType: "agent.retry",
        systemPrompt,
        userPrompt: retryPrompt,
        maxTokens: 300,
        temperature: 0.3,
      });
      const retryParsed = parseToolCalls(retryPass.content || "");
      let retryReply = retryParsed.cleanedText.trim();
      // Re-strip self-flagellation au cas où
      retryReply = retryReply
        .replace(
          /^(Désolée?,?\s+(j['’]?ai\s+merdé|j['’]?ai\s+merdoyé|j['’]?ai\s+raté|j['’]?ai\s+foiré|c['’]?était\s+nul)[.!?]?\s*)/i,
          ""
        )
        .trim();
      if (retryReply) {
        finalReply = retryReply;
      }
    } catch (err: any) {
      console.error("[orchestrator] retry LLM call failed:", err?.message || err);
    }

    // Persistance fire-and-forget pour observabilité
    supabase
      .from("agent_retries")
      .insert({
        client_id: client.id,
        phone: normalizedPhone,
        agent_signed_as: target,
        user_message: text.slice(0, 1500),
        original_reply: replyBeforeReflexive.slice(0, 1500),
        violations: validatorVerdict.violations,
        correction_hint: validatorVerdict.correction_hint,
        corrected_reply: finalReply.slice(0, 1500),
        retry_index: 1,
      })
      .then(({ error }) => {
        if (error) console.error("[agent_retries] insert error:", error.message);
      });
  }

  // 8) Send the agent's final reply
  const prefix = prefixFor(target, agentName);
  await sendMessage(phone, prefix + finalReply);
  await saveMessage(client.id, normalizedPhone, "assistant", finalReply, target);

  // 9) Cross-domain: if the agent delegated, run a second agent for its slice
  if (pendingDelegateTo && pendingDelegateTo !== target && teamAgents.includes(pendingDelegateTo)) {
    const second = pendingDelegateTo;
    const secondName = teamMembers.find((m) => m.type === second)!.name;
    const secondSystem = buildAgentSystemPrompt({
      client,
      agentName: secondName,
      agentType: second,
      teamMembers,
      customInstructions: await getCustomInstructions(client.id, second),
    });
    const secondAsk =
      pendingDelegateAsk ||
      `Ton/ta collègue ${agentName} a besoin de ta partie pour répondre à : "${text}". Donne ta vue, courte, factuelle.`;
    const secondPass = await callLLM({
      taskType: "agent.delegate",
      systemPrompt: secondSystem,
      userPrompt: secondAsk,
      maxTokens: 250,
      temperature: 0.5,
    });
    const { cleanedText: secondReply } = parseToolCalls(secondPass.content || "");
    if (secondReply.trim()) {
      const prefix2 = prefixFor(second, secondName);
      await sendMessage(phone, prefix2 + secondReply);
      await saveMessage(client.id, normalizedPhone, "assistant", secondReply, second);
    }
  }

  const durationMs = Date.now() - t0;

  await supabase.from("agent_logs").insert({
    client_id: client.id,
    agent_type: target,
    action: "orchestrator.turn",
    tokens_used: firstPass.tokensUsed?.total || 0,
    model_used: firstPass.model,
    duration_ms: durationMs,
    cost_cents: Math.ceil(((firstPass.tokensUsed?.total || 0) / 1000) * 0.0027 * 100),
    metadata: {
      whatsapp_phone: normalizedPhone,
      router: decision,
      tool_calls: toolCalls.map((c) => c.name),
      artefact_delivered: artefactDelivered,
      delegated_to: pendingDelegateTo,
    },
  });

  // Fire-and-forget : détection des signaux faibles (frustration, hallucination,
  // churn signal, etc.) → INSERT en DB + email Faicel si severity ≥ med.
  // Ne ralentit pas la réponse à l'artisan : le tour est déjà fini quand on
  // lance l'analyse. Toute erreur est logguée mais ne casse rien.
  const toolFailureSummary = toolResults
    .filter((r) => !r.ok)
    .map((r) => `${r.summary}${r.error ? ` (${r.error})` : ""}`)
    .join("; ")
    .slice(0, 300);

  detectAndLogAlerts({
    clientId: client.id,
    phone: normalizedPhone,
    clientCompany: client.company,
    agentSignedAs: target,
    userMessage: text,
    agentReply: finalReply,
    contextSnippet: historySnippet || undefined,
    toolFailureSummary: toolFailureSummary || undefined,
  }).catch((err) => console.error("[orchestrator] alert detection error:", err));

  return {
    routedTo: target,
    intent: decision.intent,
    toolCalls,
    toolResults,
    finalReply,
    artefactDelivered,
    durationMs,
  };
}
