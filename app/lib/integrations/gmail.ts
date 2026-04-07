/**
 * Gmail Integration for iArtisan
 * - OAuth2 flow (authorization URL + token exchange)
 * - Read emails (list + get)
 * - Send emails
 * - Token refresh handling
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://admin.iartisan.io/api/integrations/gmail/callback';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
].join(' ');

// Generate OAuth2 authorization URL
export function getGmailAuthUrl(clientId: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state: clientId, // Pass clientId to identify which client is connecting
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

// Exchange authorization code for tokens
export async function exchangeGmailCode(code: string, clientId: string): Promise<{ success: boolean; error?: string }> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: GOOGLE_REDIRECT_URI,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    return { success: false, error: data.error_description || 'Token exchange failed' };
  }

  // Store tokens in integrations table
  const { error } = await supabase
    .from('integrations')
    .upsert({
      client_id: clientId,
      type: 'GMAIL',
      credentials: {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        token_type: data.token_type,
        expires_at: Date.now() + (data.expires_in * 1000),
      },
      status: 'ACTIVE',
      last_synced_at: new Date().toISOString(),
    }, { onConflict: 'client_id,type' });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// Get valid access token (refresh if expired)
async function getAccessToken(clientId: string): Promise<string | null> {
  const { data: integration } = await supabase
    .from('integrations')
    .select('credentials, status')
    .eq('client_id', clientId)
    .eq('type', 'GMAIL')
    .single();

  if (!integration || integration.status !== 'ACTIVE') return null;

  const creds = integration.credentials as any;

  // Check if token is expired (with 5 min buffer)
  if (creds.expires_at < Date.now() + 300000) {
    // Refresh the token
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: creds.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      // Mark integration as expired
      await supabase
        .from('integrations')
        .update({ status: 'EXPIRED' })
        .eq('client_id', clientId)
        .eq('type', 'GMAIL');
      return null;
    }

    // Update stored tokens
    const newCreds = {
      ...creds,
      access_token: data.access_token,
      expires_at: Date.now() + (data.expires_in * 1000),
    };
    if (data.refresh_token) newCreds.refresh_token = data.refresh_token;

    await supabase
      .from('integrations')
      .update({
        credentials: newCreds,
        last_synced_at: new Date().toISOString()
      })
      .eq('client_id', clientId)
      .eq('type', 'GMAIL');

    return data.access_token;
  }

  return creds.access_token;
}

// Gmail API helper
async function gmailAPI(clientId: string, endpoint: string, options: RequestInit = {}): Promise<any> {
  const token = await getAccessToken(clientId);
  if (!token) throw new Error('Gmail not connected or token expired');

  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gmail API error (${response.status}): ${error}`);
  }

  return response.json();
}

// ── Public API ──

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: string;
  isUnread: boolean;
}

// List recent emails
export async function listEmails(clientId: string, options: {
  maxResults?: number;
  query?: string;
  unreadOnly?: boolean;
} = {}): Promise<GmailMessage[]> {
  const { maxResults = 10, query, unreadOnly = false } = options;

  let q = query || '';
  if (unreadOnly) q += ' is:unread';

  const listData = await gmailAPI(clientId, `messages?maxResults=${maxResults}&q=${encodeURIComponent(q.trim())}`);

  if (!listData.messages?.length) return [];

  // Fetch full message details
  const messages = await Promise.all(
    listData.messages.map(async (msg: any) => {
      const full = await gmailAPI(clientId, `messages/${msg.id}?format=full`);
      return parseGmailMessage(full);
    })
  );

  return messages;
}

// Get a single email
export async function getEmail(clientId: string, messageId: string): Promise<GmailMessage> {
  const full = await gmailAPI(clientId, `messages/${messageId}?format=full`);
  return parseGmailMessage(full);
}

// Send an email
export async function sendEmail(clientId: string, options: {
  to: string;
  subject: string;
  body: string;
  replyToMessageId?: string;
  threadId?: string;
}): Promise<{ id: string; threadId: string }> {
  const { to, subject, body, replyToMessageId, threadId } = options;

  // Build MIME message
  const headers = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
  ];
  if (replyToMessageId) {
    headers.push(`In-Reply-To: ${replyToMessageId}`);
    headers.push(`References: ${replyToMessageId}`);
  }

  const mimeMessage = headers.join('\r\n') + '\r\n\r\n' + body;
  const encodedMessage = Buffer.from(mimeMessage).toString('base64url');

  const sendBody: any = { raw: encodedMessage };
  if (threadId) sendBody.threadId = threadId;

  const result = await gmailAPI(clientId, 'messages/send', {
    method: 'POST',
    body: JSON.stringify(sendBody),
  });

  return { id: result.id, threadId: result.threadId };
}

// Parse Gmail API message format
function parseGmailMessage(message: any): GmailMessage {
  const headers = message.payload?.headers || [];
  const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  // Extract body
  let body = '';
  if (message.payload?.body?.data) {
    body = Buffer.from(message.payload.body.data, 'base64url').toString('utf-8');
  } else if (message.payload?.parts) {
    const textPart = message.payload.parts.find((p: any) => p.mimeType === 'text/plain');
    const htmlPart = message.payload.parts.find((p: any) => p.mimeType === 'text/html');
    const part = textPart || htmlPart;
    if (part?.body?.data) {
      body = Buffer.from(part.body.data, 'base64url').toString('utf-8');
    }
  }

  return {
    id: message.id,
    threadId: message.threadId,
    from: getHeader('From'),
    to: getHeader('To'),
    subject: getHeader('Subject'),
    body,
    date: getHeader('Date'),
    isUnread: (message.labelIds || []).includes('UNREAD'),
  };
}

// Check if Gmail is connected for a client
export async function isGmailConnected(clientId: string): Promise<boolean> {
  const { data } = await supabase
    .from('integrations')
    .select('status')
    .eq('client_id', clientId)
    .eq('type', 'GMAIL')
    .single();

  return data?.status === 'ACTIVE';
}
