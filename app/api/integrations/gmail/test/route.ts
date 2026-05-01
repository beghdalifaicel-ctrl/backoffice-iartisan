export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { listEmails, isGmailConnected } from '@/lib/integrations/gmail';
import { verifyAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const authResult = await verifyAuth(request);
  if (!authResult) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clientId = request.nextUrl.searchParams.get('clientId');
  if (!clientId) {
    return NextResponse.json({ error: 'clientId required' }, { status: 400 });
  }

  const connected = await isGmailConnected(clientId);
  if (!connected) {
    return NextResponse.json({ connected: false, message: 'Gmail not connected' });
  }

  try {
    const emails = await listEmails(clientId, { maxResults: 3, unreadOnly: true });
    return NextResponse.json({
      connected: true,
      emailCount: emails.length,
      emails: emails.map(e => ({ from: e.from, subject: e.subject, date: e.date })),
    });
  } catch (err: any) {
    return NextResponse.json({ connected: true, error: err.message }, { status: 500 });
  }
}
