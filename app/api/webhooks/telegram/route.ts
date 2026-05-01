export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callLLM } from "@/lib/agents/llm";
import { AgentType, PlanType, PLAN_AGENTS, DEFAULT_AGENT_NAMES } from "@/lib/agents/types";

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Message persistence helper ──────────────────────────────

async function saveMessage(opts: {
  clientId: string;
  content: string;
  fromAdmin: boolean;
}) {
  try {
    const id = crypto.randomUUID();
    await supabase.from("messages").insert({
      id,
      content: opts.content,
      fromAdmin: opts.fromAdmin,
      read: opts.fromAdmin,
      clientId: opts.clientId,
    });
  } catch (err) {
    console.error("Failed to save message:", err);
  }
}

// ─── Telegram API helpers ─────────────────────────────────

async function sendMessage(chatId: number, text: string, parseMode = "HTML") {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: parseMode,
    }),
  });
}

async function sendTyping(chatId: number) {
  await fetch(`${TELEGRAM_API}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action: "typing" }),
  });
}

// ─── Link / lookup client from Telegram chat ──────────────

async function getClientByChatId(chatId: number) {
  const { data } = await supabase
    .from("channel_links")
    .select("client_id")
    .eq("channel", "telegram")
    .eq("channel_user_id", String(chatId))
    .eq("is_active", true)
    .single();

  if (!data) return null;

  const { data: client } = await supabase
    .from("clients")
    .select("id, plan, company, metier, ville, status, firstName, lastName")
    .eq("id", data.client_id)
    .single();

  return client;
}

async function linkTelegramAccount(chatId: number, clientId: string) {
  // Vérifier que le client existe
  const { data: client } = await supabase
    .from("clients")
    .select("id, firstName, company")
    .eq("id", clientId)
    .single();

  if (!client) return null;

  // Upsert le lien (unique constraint on channel + channel_user_id)
  await supabase.from("channel_links").upsert(
    {
      client_id: clientId,
      channel: "telegram",
      channel_user_id: String(chatId),
      is_active: true,
      linked_at: new Date().toISOString(),
    },
    { onConflict: "channel,channel_user_id" }
  );

  return client;
}

// ─── Get agent config (display name) ──────────────────────

async function getAgentDisplayName(clientId: string, agentType: AgentType): Promise<string> {
  const { data } = await supabase
    .from("agent_configs")
    .select("display_name")
    .eq("client_id", clientId)
    .eq("agent_type", agentType)
    .single();

  return data?.display_name || DEFAULT_AGENT_NAMES[agentType];
}

// ─── Build system prompt for conversational agent ─────────

function buildChatPrompt(client: any, agentName: string): string {
  return `Tu es ${agentName}, l'assistant IA de l'entreprise "${client.company}" (${client.metier} à ${client.ville}).
Tu parles à ${client.firstName || "votre client"} via Telegram.

IMPORTANT — Accords de genre : Adapte TOUJOURS les accords grammaticaux (adjectifs, participes passés) au prénom de ton interlocuteur.
Par exemple : si la personne s'appelle Sophie, Marie, Léa → utilise le féminin ("prête", "connectée", "satisfaite").
Si la personne s'appelle Jean, Marc, Pierre → utilise le masculin ("prêt", "connecté", "satisfait").
En cas de doute, utilise une formulation neutre.

Tu es professionnel·le, concis·e et chaleureux·se. Tu parles toujours en français.
Tu peux aider avec :
- Lire et résumer les emails reçus
- Rédiger et envoyer des réponses email
- Créer des devis et des factures
- Relancer les clients en attente
- Donner un résumé de l'activité récente

Si on te demande quelque chose que tu ne peux pas faire, dis-le honnêtement et propose une alternative.
Réponds de manière concise (max 3-4 paragraphes). Utilise des emojis avec parcimonie.
Ne réponds JAMAIS en Markdown. Utilise du texte brut ou du HTML simple (<b>, <i>).`;
}

// ─── Webhook handler ──────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const update = await req.json();

    // Ignorer tout sauf les messages texte
    const message = update.message;
    if (!message?.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const text = message.text.trim();
    const firstName = message.from?.first_name || "there";

    // ── /start {clientId} → lier le compte ──
    if (text.startsWith("/start")) {
      const clientId = text.split(" ")[1];

      if (!clientId) {
        await sendMessage(chatId,
          `👋 Bonjour ${firstName} !\n\nBienvenue sur <b>iArtisan</b>.\n\nPour lier votre compte, connectez-vous sur votre espace client et suivez l'étape Telegram dans l'onboarding.`
        );
        return NextResponse.json({ ok: true });
      }

      const client = await linkTelegramAccount(chatId, clientId);

      if (!client) {
        await sendMessage(chatId, "❌ Ce code ne correspond à aucun compte. Vérifiez et réessayez.");
        return NextResponse.json({ ok: true });
      }

      const agentName = await getAgentDisplayName(clientId, "ADMIN");

      await sendMessage(chatId,
        `✅ Compte lié avec succès !\n\n👋 Bonjour ${client.firstName || firstName}, je suis <b>${agentName}</b>, votre assistant·e IA pour <b>${client.company}</b>.\n\nVous pouvez me demander :\n• "Résume mes emails"\n• "Rédige un devis pour..."\n• "Relance le client X"\n• "Aide"\n\nC'est parti ! 💪`
      );

      return NextResponse.json({ ok: true });
    }

    // ── /aide ou /help ──
    if (text === "/aide" || text === "/help" || text.toLowerCase() === "aide") {
      const client = await getClientByChatId(chatId);
      if (!client) {
        await sendMessage(chatId, "⚠️ Votre compte n'est pas lié. Utilisez le QR code dans votre espace client pour commencer.");
        return NextResponse.json({ ok: true });
      }

      const agentName = await getAgentDisplayName(client.id, "ADMIN");
      const agents = PLAN_AGENTS[client.plan as PlanType] || ["ADMIN"];

      let helpText = `🤖 <b>${agentName} — Assistant ${client.company}</b>\n\n`;
      helpText += `Voici ce que je peux faire :\n\n`;
      helpText += `📧 <b>Emails</b> : "Résume mes emails", "Réponds à [email]"\n`;
      helpText += `📝 <b>Devis</b> : "Fais un devis pour [description]"\n`;
      helpText += `🧾 <b>Factures</b> : "Facture pour [client]"\n`;
      helpText += `🔔 <b>Relances</b> : "Relance [client]"\n`;
      helpText += `📊 <b>Résumé</b> : "Résumé de la semaine"\n`;

      if (agents.includes("MARKETING")) {
        helpText += `\n📢 <b>Marketing</b> : "Poste sur Google", "Réponds aux avis"\n`;
      }
      if (agents.includes("COMMERCIAL")) {
        helpText += `\n💼 <b>Commercial</b> : "Trouve des prospects à [ville]", "Relance les impayés"\n`;
      }

      helpText += `\nÉcrivez simplement ce dont vous avez besoin ! 💬`;

      await sendMessage(chatId, helpText);
      return NextResponse.json({ ok: true });
    }

    // ── Message normal → LLM ──
    const client = await getClientByChatId(chatId);

    if (!client) {
      await sendMessage(chatId,
        `👋 Bonjour !\n\nJe ne vous reconnais pas encore. Pour commencer :\n1. Connectez-vous sur votre <b>espace client iArtisan</b>\n2. Allez dans l'onboarding, étape Telegram\n3. Scannez le QR code ou cliquez le lien\n\nÀ tout de suite ! 🚀`
      );
      return NextResponse.json({ ok: true });
    }

    // Vérifier le statut du client
    if (!["ACTIVE", "TRIAL"].includes(client.status)) {
      await sendMessage(chatId, "⚠️ Votre abonnement n'est pas actif. Contactez le support pour réactiver votre compte.");
      return NextResponse.json({ ok: true });
    }

    // Envoyer "typing..."
    await sendTyping(chatId);

    // Déterminer l'agent à utiliser (ADMIN par défaut, détection basique)
    let agentType: AgentType = "ADMIN";
    const lowerText = text.toLowerCase();

    if (
      lowerText.includes("prospect") ||
      lowerText.includes("lead") ||
      lowerText.includes("impayé") ||
      lowerText.includes("recouvrement")
    ) {
      const plan = client.plan as PlanType;
      if (PLAN_AGENTS[plan].includes("COMMERCIAL")) {
        agentType = "COMMERCIAL";
      }
    } else if (
      lowerText.includes("google") ||
      lowerText.includes("avis") ||
      lowerText.includes("seo") ||
      lowerText.includes("réseaux") ||
      lowerText.includes("post")
    ) {
      const plan = client.plan as PlanType;
      if (PLAN_AGENTS[plan].includes("MARKETING")) {
        agentType = "MARKETING";
      }
    }

    const agentName = await getAgentDisplayName(client.id, agentType);
    const systemPrompt = buildChatPrompt(client, agentName);

    // Persist incoming user message
    await saveMessage({
      clientId: client.id,
      content: text,
      fromAdmin: false,
    });

    // Appeler Mistral
    const response = await callLLM({
      taskType: "email.reply", // Use balanced tier for conversational
      systemPrompt,
      userPrompt: text,
      maxTokens: 1024,
      temperature: 0.5,
    });

    // Envoyer la réponse
    const reply = response.content || "Désolé, je n'ai pas pu traiter votre demande. Réessayez.";

    // Telegram limite à 4096 chars
    if (reply.length > 4000) {
      const parts = reply.match(/[\s\S]{1,4000}/g) || [reply];
      for (const part of parts) {
        await sendMessage(chatId, part);
      }
    } else {
      await sendMessage(chatId, reply);
    }

    // Persist agent response
    await saveMessage({
      clientId: client.id,
      content: reply,
      fromAdmin: true,
    });

    // Logger l'interaction
    await supabase.from("agent_logs").insert({
      client_id: client.id,
      agent_type: agentType,
      action: "telegram.chat",
      tokens_used: response.tokensUsed.total,
      model_used: response.model,
      duration_ms: response.durationMs,
      cost_cents: Math.ceil((response.tokensUsed.total / 1000) * 0.0027 * 100),
      metadata: {
        telegram_chat_id: chatId,
        user_message: text.substring(0, 200),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Telegram webhook error:", error);
    // Telegram attend toujours un 200 OK sinon il retry
    return NextResponse.json({ ok: true });
  }
}
