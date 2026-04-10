/**
 * Telegram Bot Webhook
 *
 * Setup:
 * 1. Create bot via @BotFather → get TELEGRAM_BOT_TOKEN
 * 2. Set webhook: POST https://api.telegram.org/bot<TOKEN>/setWebhook
 *    body: { "url": "https://backoffice-iartisan.vercel.app/api/channels/telegram" }
 * 3. Add TELEGRAM_BOT_TOKEN to Vercel env vars
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleChannelMessage } from '@/lib/channels/handler';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Telegram sends updates as POST
export async function POST(request: NextRequest) {
  if (!TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ error: 'Telegram not configured' }, { status: 500 });
  }

  let update;
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ ok: true }); // Ignore malformed requests
  }

  // Extract message (could be a regular message or an edited message)
  const message = update.message || update.edited_message;
  if (!message || !message.text) {
    return NextResponse.json({ ok: true }); // Ignore non-text messages
  }

  const chatId = String(message.chat.id);
  const text = message.text;
  const displayName = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ');

  // Handle /start command (Telegram convention)
  const messageText = text === '/start' ? 'aide' : text;

  try {
    // Process through shared handler
    const response = await handleChannelMessage({
      channel: 'telegram',
      channelUserId: chatId,
      text: messageText,
      displayName,
    });

    // Send reply via Telegram API
    await sendTelegramMessage(chatId, response.text);
  } catch (err: any) {
    console.error('Telegram webhook error:', err);
    await sendTelegramMessage(chatId, "❌ Une erreur est survenue. Réessayez dans quelques instants.");
  }

  // Always return 200 to Telegram (otherwise it retries)
  return NextResponse.json({ ok: true });
}

// Verify webhook is alive (Telegram may GET the URL during setup)
export async function GET() {
  return NextResponse.json({
    ok: true,
    channel: 'telegram',
    status: TELEGRAM_BOT_TOKEN ? 'configured' : 'not_configured',
  });
}

// Send a message via Telegram Bot API
async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  // Try with Markdown first, fallback to plain text if parsing fails
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    }),
  });

  const data = await res.json();

  // If Markdown parsing failed, retry without parse_mode
  if (!data.ok && data.error_code === 400) {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.replace(/[*_`\[\]]/g, ''), // Strip markdown chars
        disable_web_page_preview: true,
      }),
    });
  }
}
