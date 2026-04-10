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
const GROQ_API_KEY = process.env.GROQ_API_KEY; // For Whisper transcription (free tier)

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
  if (!message) {
    return NextResponse.json({ ok: true });
  }

  const chatId = String(message.chat.id);
  const displayName = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ');

  // Handle voice messages — transcribe then process as text
  let text = message.text;
  if (!text && message.voice) {
    try {
      text = await transcribeVoiceMessage(message.voice.file_id);
      if (!text) {
        await sendTelegramMessage(chatId, "🎙️ Je n'ai pas réussi à transcrire votre vocal. Réessayez ou envoyez un message texte.");
        return NextResponse.json({ ok: true });
      }
    } catch (err: any) {
      console.error('Voice transcription error:', err);
      await sendTelegramMessage(chatId, "🎙️ Erreur de transcription du vocal. Envoyez un message texte en attendant.");
      return NextResponse.json({ ok: true });
    }
  }

  // Also handle audio files (not just voice notes)
  if (!text && message.audio) {
    try {
      text = await transcribeVoiceMessage(message.audio.file_id);
      if (!text) {
        await sendTelegramMessage(chatId, "🎙️ Je n'ai pas réussi à transcrire votre audio. Réessayez ou envoyez un message texte.");
        return NextResponse.json({ ok: true });
      }
    } catch (err: any) {
      console.error('Audio transcription error:', err);
      await sendTelegramMessage(chatId, "🎙️ Erreur de transcription de l'audio. Envoyez un message texte en attendant.");
      return NextResponse.json({ ok: true });
    }
  }

  // Ignore other non-text messages (photos, stickers, etc.)
  if (!text) {
    await sendTelegramMessage(chatId, "📝 Je ne comprends que les messages texte et vocaux pour l'instant.");
    return NextResponse.json({ ok: true });
  }

  // Handle /start command (Telegram convention)
  const isVoice = !message.text && (message.voice || message.audio);
  const messageText = text === '/start' ? 'aide' : text;

  try {
    // Process through shared handler
    const response = await handleChannelMessage({
      channel: 'telegram',
      channelUserId: chatId,
      text: messageText,
      displayName,
    });

    // Prefix with transcription indicator if from voice
    const prefix = isVoice ? `🎙️ _"${messageText.substring(0, 80)}${messageText.length > 80 ? '...' : ''}"_\n\n` : '';
    // Send reply via Telegram API
    await sendTelegramMessage(chatId, prefix + response.text);
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

// Transcribe a Telegram voice message using Groq Whisper (free) or fallback
async function transcribeVoiceMessage(fileId: string): Promise<string | null> {
  // Step 1: Get file path from Telegram
  const fileRes = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`
  );
  const fileData = await fileRes.json();

  if (!fileData.ok || !fileData.result?.file_path) {
    throw new Error('Failed to get Telegram file path');
  }

  // Step 2: Download the audio file
  const audioUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileData.result.file_path}`;
  const audioRes = await fetch(audioUrl);
  const audioBuffer = await audioRes.arrayBuffer();

  // Step 3: Determine file extension — Telegram voice notes are .oga (Opus in OGG)
  // Groq/OpenAI Whisper expect standard extensions, so normalize to .ogg
  const filePath = fileData.result.file_path as string;
  const rawExt = filePath.split('.').pop() || 'ogg';
  const ext = rawExt === 'oga' ? 'ogg' : rawExt;
  const mimeType = ext === 'ogg' ? 'audio/ogg' : ext === 'mp3' ? 'audio/mpeg' : `audio/${ext}`;

  // Step 4: Transcribe via Groq Whisper API (free, fast)
  if (GROQ_API_KEY) {
    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer], { type: mimeType }), `voice.${ext}`);
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('language', 'fr');
    formData.append('response_format', 'text');

    const transcriptRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: formData,
    });

    if (transcriptRes.ok) {
      const transcription = await transcriptRes.text();
      console.log('Groq transcription OK:', transcription.substring(0, 100));
      return transcription.trim() || null;
    }

    const groqError = await transcriptRes.text();
    console.error('Groq transcription failed:', transcriptRes.status, groqError);
  }

  // Fallback: if no Groq key, try OpenAI Whisper
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer], { type: `audio/${ext}` }), `voice.${ext}`);
    formData.append('model', 'whisper-1');
    formData.append('language', 'fr');
    formData.append('response_format', 'text');

    const transcriptRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
      },
      body: formData,
    });

    if (transcriptRes.ok) {
      const transcription = await transcriptRes.text();
      return transcription.trim() || null;
    }

    console.error('OpenAI transcription failed:', await transcriptRes.text());
  }

  throw new Error('No transcription API configured — set GROQ_API_KEY or OPENAI_API_KEY');
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
