export const dynamic = "force-dynamic";
/**
 * Admin Knowledge Seed — /api/admin/knowledge/seed
 *
 * POST: Ingest a knowledge document for a specific client (admin only)
 * Protected by CRON_SECRET query param
 */

import { NextRequest, NextResponse } from 'next/server';
import { ingestDocument } from '@/lib/knowledge/rag';
import { AgentType } from '@/lib/agents/types';

export async function POST(request: NextRequest) {
  // Admin auth via CRON_SECRET
  const cronSecret = request.nextUrl.searchParams.get('secret');
  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { clientId, name, content, description, agentTypes, structured } = body;

    if (!clientId || !name || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: clientId, name, content' },
        { status: 400 }
      );
    }

    const result = await ingestDocument(clientId, name, content, {
      description: description || '',
      fileType: 'text',
      agentTypes: agentTypes || ['ADMIN', 'MARKETING', 'COMMERCIAL'],
      structured: structured || false,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      documentId: result.documentId,
      chunkCount: result.chunkCount,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
