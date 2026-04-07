// WhatsApp Business Cloud API + Telegram Bot integration
// For artisan ↔ agent communication

interface MessagePayload {
  to: string; // Phone number (WhatsApp) or chat ID (Telegram)
  text: string;
  channel: 'whatsapp' | 'telegram';
}

interface IncomingMessage {
  from: string;
  text: string;
  channel: 'whatsapp' | 'telegram';
  timestamp: Date;
  metadata?: Record<string, any>;
}

// ── WhatsApp Business Cloud API ──

export async function sendWhatsApp(
  to: string,
  text: string
): Promise<{ success: boolean; messageId?: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    return { success: false };
  }

  try {
    const response = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to.replace(/[^0-9]/g, ''), // Clean phone number
        type: 'text',
        text: { body: text },
      }),
    });

    const data = await response.json();
    return {
      success: response.ok,
      messageId: data.messages?.[0]?.id,
    };
  } catch (err) {
    console.error('[WhatsApp] Send error:', err);
    return { success: false };
  }
}

// ── Telegram Bot API ──

export async function sendTelegram(chatId: string, text: string): Promise<{ success: boolean; messageId?: number }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    return { success: false };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });

    const data = await response.json();
    return {
      success: data.ok,
      messageId: data.result?.message_id,
    };
  } catch (err) {
    console.error('[Telegram] Send error:', err);
    return { success: false };
  }
}

// ── Unified send ──

export async function sendMessage(payload: MessagePayload): Promise<{ success: boolean }> {
  if (payload.channel === 'whatsapp') {
    return sendWhatsApp(payload.to, payload.text);
  } else {
    return sendTelegram(payload.to, payload.text);
  }
}
