/**
 * Shared channel handler for WhatsApp / Telegram
 *
 * Flow:
 * 1. Incoming message → identify sender via channel_links
 * 2. If not linked → return onboarding instructions
 * 3. If linked → detect intent (agent type + task type) via LLM
 * 4. Submit + process task synchronously
 * 5. Return the agent's text response
 */

import { createClient } from '@supabase/supabase-js';
import { orchestrator } from '../agents/orchestrator';
import { callLLM } from '../agents/llm';
import { AgentType, AGENT_CAPABILITIES, PLAN_AGENTS, PLAN_QUOTAS, PlanType, DEFAULT_AGENT_NAMES } from '../agents/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface ChannelMessage {
  channel: 'telegram' | 'whatsapp';
  channelUserId: string;
  text: string;
  displayName?: string;
  phone?: string;
}

export interface ChannelResponse {
  text: string;
  isLinked: boolean;
}

// Link an artisan's channel account to their iArtisan client ID
export async function linkChannel(
  channel: 'telegram' | 'whatsapp',
  channelUserId: string,
  linkCode: string,
  displayName?: string,
  phone?: string
): Promise<{ success: boolean; message: string }> {
  // Link codes are stored as "link_<clientId>" in agent_configs metadata
  // Or we just use the clientId directly as the code for simplicity
  const clientId = linkCode.replace('link_', '');

  const { data: client } = await supabase
    .from('clients')
    .select('id, company')
    .eq('id', clientId)
    .single();

  if (!client) {
    return { success: false, message: "Code invalide. Vérifiez votre code de liaison dans votre espace iArtisan." };
  }

  // Upsert the channel link
  const { error } = await supabase
    .from('channel_links')
    .upsert({
      client_id: clientId,
      channel,
      channel_user_id: channelUserId,
      display_name: displayName,
      phone,
      is_active: true,
      linked_at: new Date().toISOString(),
    }, { onConflict: 'channel,channel_user_id' });

  if (error) {
    return { success: false, message: "Erreur lors de la liaison. Réessayez." };
  }

  return { success: true, message: `✅ Compte lié à ${client.company} ! Vous pouvez maintenant parler à vos agents IA. Tapez "aide" pour voir ce que je peux faire.` };
}

// Find the client ID for a channel user
async function findClientId(channel: string, channelUserId: string): Promise<string | null> {
  const { data } = await supabase
    .from('channel_links')
    .select('client_id')
    .eq('channel', channel)
    .eq('channel_user_id', channelUserId)
    .eq('is_active', true)
    .single();

  return data?.client_id || null;
}

// Detect intent from the message and route to the right agent
async function detectIntent(
  message: string,
  availableAgents: AgentType[]
): Promise<{ agentType: AgentType; taskType: string; payload: Record<string, any> }> {
  // Build capability map for available agents only
  const capabilityMap: string[] = [];
  for (const agent of availableAgents) {
    const caps = AGENT_CAPABILITIES[agent];
    for (const cap of caps) {
      capabilityMap.push(`${agent}.${cap}`);
    }
  }

  const response = await callLLM({
    taskType: 'intent.detect',
    systemPrompt: `Tu es un routeur intelligent pour les agents IA d'un artisan du bâtiment.
Analyse le message de l'artisan et détermine quel agent et quelle action utiliser.

Agents et capacités disponibles :
${capabilityMap.join('\n')}

Réponds UNIQUEMENT en JSON strict (pas de markdown) :
{"agentType": "ADMIN|MARKETING|COMMERCIAL", "taskType": "le.type.exact", "payload": {clés pertinentes extraites du message}}

Exemples :
- "Lis mes emails" → {"agentType":"ADMIN","taskType":"email.read","payload":{"maxResults":10}}
- "Fais un devis pour M. Martin, salle de bain 5000€" → {"agentType":"ADMIN","taskType":"quote.generate","payload":{"clientName":"M. Martin","description":"salle de bain","items":[{"label":"Rénovation salle de bain","quantity":1,"unitPrice":5000}]}}
- "Optimise ma fiche Google" → {"agentType":"MARKETING","taskType":"gbp.optimize","payload":{"action":"full_optimization"}}
- "Trouve des prospects plombier à Lyon" → {"agentType":"COMMERCIAL","taskType":"lead.scrape","payload":{"zone":"Lyon","metier":"plombier"}}
- "Relance la facture de 2500€ de Mme Dupont" → {"agentType":"COMMERCIAL","taskType":"invoice.collect","payload":{"clientName":"Mme Dupont","amount":2500}}`,
    userPrompt: message,
    tools: [],
    responseFormat: 'json',
  });

  try {
    const intent = JSON.parse(response.content);
    return {
      agentType: intent.agentType as AgentType,
      taskType: intent.taskType,
      payload: intent.payload || {},
    };
  } catch {
    // Default to ADMIN if parsing fails
    return {
      agentType: 'ADMIN',
      taskType: 'email.read',
      payload: { query: message },
    };
  }
}

// Format the help message based on available agents
function buildHelpMessage(plan: PlanType): string {
  const agents = PLAN_AGENTS[plan];
  let help = "🤖 *Vos agents iArtisan*\n\nVoici ce que je peux faire :\n\n";

  if (agents.includes('ADMIN')) {
    help += "📋 *Agent Admin*\n";
    help += "• \"Lis mes emails\" — consulter vos emails\n";
    help += "• \"Fais un devis pour [client], [travaux], [montant]\" — générer un devis\n";
    help += "• \"Facture [client] [montant]\" — générer une facture\n";
    help += "• \"Relance [client]\" — envoyer une relance\n\n";
  }

  if (agents.includes('MARKETING')) {
    help += "📢 *Agent Marketing*\n";
    help += "• \"Optimise ma fiche Google\" — audit GBP\n";
    help += "• \"Crée un post Google\" — post GBP\n";
    help += "• \"Réponds à l'avis de [client]\" — réponse aux avis\n";
    help += "• \"Audit SEO\" — analyse référencement local\n\n";
  }

  if (agents.includes('COMMERCIAL')) {
    help += "💼 *Agent Commercial*\n";
    help += "• \"Trouve des prospects [métier] à [ville]\" — prospection\n";
    help += "• \"Qualifie ce lead : [message du prospect]\" — qualification\n";
    help += "• \"Relance la facture de [montant]€ de [client]\" — recouvrement\n";
    help += "• \"Inscris-moi sur [annuaire]\" — inscription annuaires\n\n";
  }

  help += "💡 Écrivez simplement ce dont vous avez besoin, je comprends le langage naturel !";
  return help;
}

// Check message usage and increment counter. Returns null if OK, or a message string if limit reached.
async function checkMessageLimit(
  clientId: string,
  channel: string,
  plan: PlanType
): Promise<{ allowed: boolean; message?: string; usage?: number; limit?: number }> {
  const monthlyLimit = PLAN_QUOTAS[plan].messages;

  // -1 means unlimited (MAX / Max plan)
  if (monthlyLimit === -1) {
    return { allowed: true };
  }

  // Call the Supabase RPC function for atomic increment
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const { data, error } = await supabase.rpc('check_and_increment_messages', {
    p_client_id: clientId,
    p_channel: channel,
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_limit: monthlyLimit,
  });

  if (error) {
    // On error, allow the message (fail open) but log it
    console.error('Message limit check error:', error);
    return { allowed: true };
  }

  const currentUsage = data?.messages_used || 0;

  // 100% — blocked
  if (currentUsage > monthlyLimit) {
    const planNames: Record<PlanType, string> = {
      ESSENTIEL: 'Pro (99€/mois)',
      PRO: 'Max (179€/mois)',
      MAX: 'Max',
    };
    const upgradeTo = planNames[plan];
    return {
      allowed: false,
      usage: currentUsage,
      limit: monthlyLimit,
      message: `⚠️ Vous avez atteint votre limite de ${monthlyLimit} messages ce mois-ci.\n\n🚀 Passez au plan ${upgradeTo} pour continuer à utiliser vos agents !\n\n👉 iartisan.io/upgrade`,
    };
  }

  // 80% warning threshold
  const warningThreshold = Math.floor(monthlyLimit * 0.8);
  if (currentUsage >= warningThreshold) {
    const remaining = monthlyLimit - currentUsage;
    return {
      allowed: true,
      usage: currentUsage,
      limit: monthlyLimit,
      message: `\n\n💡 _Il vous reste ${remaining} message${remaining > 1 ? 's' : ''} ce mois (${currentUsage}/${monthlyLimit})._`,
    };
  }

  return { allowed: true, usage: currentUsage, limit: monthlyLimit };
}

// Get custom agent display name from agent_configs
async function getAgentDisplayName(clientId: string, agentType: AgentType): Promise<string> {
  const { data } = await supabase
    .from('agent_configs')
    .select('display_name')
    .eq('client_id', clientId)
    .eq('agent_type', agentType)
    .single();

  return data?.display_name || DEFAULT_AGENT_NAMES[agentType];
}

// Main handler: process an incoming channel message
export async function handleChannelMessage(msg: ChannelMessage): Promise<ChannelResponse> {
  const { channel, channelUserId, text, displayName, phone } = msg;

  // 1. Check if user is linked
  const clientId = await findClientId(channel, channelUserId);

  if (!clientId) {
    // Check if message is a link code
    const trimmed = text.trim();
    if (trimmed.startsWith('link_') || trimmed.match(/^[a-zA-Z0-9-]{5,}$/)) {
      const result = await linkChannel(channel, channelUserId, trimmed, displayName, phone);
      return { text: result.message, isLinked: result.success };
    }

    return {
      text: "👋 Bienvenue sur iArtisan !\n\nPour connecter vos agents IA, envoyez votre code de liaison.\nVous le trouverez dans votre espace admin sur iartisan.io → Paramètres → Canaux.\n\nExemple : link_votre-client-id",
      isLinked: false,
    };
  }

  // 2. Get client info
  const { data: client } = await supabase
    .from('clients')
    .select('plan, company, status')
    .eq('id', clientId)
    .single();

  if (!client || !['ACTIVE', 'TRIAL'].includes(client.status || '')) {
    return { text: "⚠️ Votre compte iArtisan n'est pas actif. Contactez le support.", isLinked: true };
  }

  const plan = client.plan as PlanType;

  // 3. Handle help command (doesn't count toward message limit)
  const lower = text.trim().toLowerCase();
  if (['aide', 'help', '/aide', '/help', '/start', 'menu'].includes(lower)) {
    return { text: buildHelpMessage(plan), isLinked: true };
  }

  // 4. Check message limit BEFORE processing
  const limitCheck = await checkMessageLimit(clientId, channel, plan);
  if (!limitCheck.allowed) {
    return { text: limitCheck.message!, isLinked: true };
  }

  // 5. Detect intent
  const availableAgents = PLAN_AGENTS[plan];
  const intent = await detectIntent(text, availableAgents);

  // 6. Get custom agent name
  const agentName = await getAgentDisplayName(clientId, intent.agentType);

  // 7. Submit task
  const submitResult = await orchestrator.submitTask(
    clientId,
    intent.agentType,
    intent.taskType,
    { ...intent.payload, _channelMessage: text },
    1, // priority 1 = high (chat is real-time)
  );

  if ('error' in submitResult) {
    return {
      text: `⚠️ ${submitResult.error}\n\nTapez "aide" pour voir les actions disponibles.`,
      isLinked: true,
    };
  }

  // 8. Process task synchronously (instead of waiting for cron)
  try {
    await orchestrator.processTask(submitResult.taskId);
  } catch (err: any) {
    return {
      text: `❌ Erreur lors du traitement : ${err.message}\nRéessayez dans quelques instants.`,
      isLinked: true,
    };
  }

  // 9. Fetch the result
  const { data: task } = await supabase
    .from('agent_tasks')
    .select('status, result, error')
    .eq('id', submitResult.taskId)
    .single();

  if (!task || task.status === 'FAILED') {
    return {
      text: `❌ ${agentName} n'a pas pu traiter votre demande${task?.error ? ` : ${task.error}` : ''}.\nRéessayez ou reformulez.`,
      isLinked: true,
    };
  }

  // 10. Format the response with custom agent name
  const result = task.result || {};
  let responseText = result.content || '';

  // If the response is too long for messaging, truncate
  if (responseText.length > 3000) {
    responseText = responseText.substring(0, 2900) + '\n\n... (résultat complet envoyé par email)';
  }

  // Add personalized agent badge with custom name
  const agentEmoji: Record<string, string> = { ADMIN: '📋', MARKETING: '📢', COMMERCIAL: '💼' };
  const badge = `${agentEmoji[intent.agentType] || '🤖'} *${agentName}*\n\n`;

  let fullResponse = badge + (responseText || "✅ Tâche exécutée. Vérifiez votre email pour les détails.");

  // Append usage warning if near limit (80%+)
  if (limitCheck.message) {
    fullResponse += limitCheck.message;
  }

  return {
    text: fullResponse,
    isLinked: true,
  };
}
