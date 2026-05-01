export const dynamic = "force-dynamic";
/**
 * WhatsApp Webhook (via Ringover or WhatsApp Business API)
 *
 * Supports two modes:
 * 1. Ringover webhooks — receives call/message events from Ringover
 * 2. WhatsApp Business API (Cloud API) — direct Meta webhook
 *
 * Setup Ringover:
 * - Create webhook in Ringover dashboard → URL: https://backoffice-iartisan.vercel.app/api/channels/whatsapp
 * - Event types: whatsapp_message_received
 *
 * Setup WhatsApp Business API:
 * - Add WHATSAPP_VERIFY_TOKEN and WHATSAPP_ACCESS_TOKEN to env vars
 * - Set webhook URL in Meta Business Manager
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleChannelMessage } from '@/lib/channels/handler';

const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'iartisan-whatsapp-verify';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

// GET — WhatsApp webhook verification (Meta requires this)
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('hub.mode');
  const token = request.nextUrl.searchParams.get('hub.verify_token');
  const challenge = request.nextUrl.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({
    ok: true,
    channel: 'whatsapp',
    status: WHATSAPP_ACCESS_TOKEN ? 'configured' : 'not_configured',
  });
}

// POST — Incoming WhatsApp messages
export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  // Detect source: Ringover or WhatsApp Cloud API
  if (body.event_type || body.event) {
    return handleRingoverWebhook(body);
  } else if (body.object === 'whatsapp_business_account') {
    return handleWhatsAppCloudAPI(body);
  }

  return NextResponse.json({ ok: true });
}

// ── Ringover Handler ────────────────────
async function handleRingoverWebhook(body: any): Promise<NextResponse> {
  // Ringover sends various event types
  const eventType = body.event_type || body.event;

  // Only handle incoming WhatsApp messages
  if (!['whatsapp_message_received', 'WHATSAPP_MESSAGE_RECEIVED'].includes(eventType)) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const data = body.data || body;
  const fromPhone = data.from_number || data.from || data.sender;
  const messageText = data.body || data.message || data.text || data.content;

  if (!fromPhone || !messageText) {
    return NextResponse.json({ ok: true, skipped: 'no_content' });
  }

  // Normalize phone number (remove +, spaces, etc.)
  const normalizedPhone = fromPhone.replace(/[^0-9]/g, '');

  try {
    const response = await handleChannelMessage({
      channel: 'whatsapp',
      channelUserId: normalizedPhone,
      text: messageText,
      phone: fromPhone,
      displayName: data.contact_name || data.sender_name,
    });

    // Reply via Ringover
    await replyViaRingover(fromPhone, response.text);
  } catch (err: any) {
    console.error('WhatsApp Ringover webhook error:', err);
  }

  return NextResponse.json({ ok: true });
}

// ── WhatsApp Cloud API Handler ────────────────────
async function handleWhatsAppCloudAPI(body: any): Promise<NextResponse> {
  const entries = body.entry || [];

  for (const entry of entries) {
    const changes = entry.changes || [];
    for (const change of changes) {
      if (change.field !== 'messages') continue;

      const messages = change.value?.messages || [];
      for (const message of messages) {
        if (message.type !== 'text') continue;

        const fromPhone = message.from;
        const messageText = message.text?.body;
        const contactName = change.value?.contacts?.[0]?.profile?.name;

        if (!fromPhone || !messageText) continue;

        try {
          const response = await handleChannelMessage({
            channel: 'whatsapp',
            channelUserId: fromPhone,
            text: messageText,
            phone: fromPhone,
            displayName: contactName,
          });

          // Reply via WhatsApp Cloud API
          await replyViaWhatsAppAPI(fromPhone, response.text);
        } catch (err: any) {
          console.error('WhatsApp Cloud API webhook error:', err);
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}

// ── Reply functions ────────────────────

async function replyViaRingover(toPhone: string, text: string): Promise<void> {
  const RINGOVER_API_KEY = process.env.RINGOVER_API_KEY;
  if (!RINGOVER_API_KEY) {
    console.warn('RINGOVER_API_KEY not set, cannot reply via Ringover WhatsApp');
    return;
  }

  try {
    await fetch('https://public-api.ringover.com/v2/whatsapp/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RINGOVER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to_number: toPhone,
        body: text,
      }),
    });
  } catch (err: any) {
    console.error('Ringover WhatsApp reply error:', err.message);
  }
}

async function replyViaWhatsAppAPI(toPhone: string, text: string): Promise<void> {
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.warn('WhatsApp Cloud API not configured');
    return;
  }

  try {
    await fetch(
      `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: toPhone,
          type: 'text',
          text: { body: text },
        }),
      }
    );
  } catch (err: any) {
    console.error('WhatsApp Cloud API reply error:', err.message);
  }
}
