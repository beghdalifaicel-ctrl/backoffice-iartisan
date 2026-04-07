import { NextRequest, NextResponse } from 'next/server';
import { getGmailAuthUrl } from '@/lib/integrations/gmail';
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

  const authUrl = getGmailAuthUrl(clientId);
  return NextResponse.json({ authUrl });
}
