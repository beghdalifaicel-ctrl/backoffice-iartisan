export const dynamic = "force-dynamic";
/**
 * Knowledge Base API — /api/client/knowledge
 *
 * GET:    List all documents for the authenticated client
 * POST:   Upload/create a new knowledge document (text content or file)
 * DELETE: Remove a document by ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/auth';
import { ingestDocument, listDocuments, deleteDocument } from '@/lib/knowledge/rag';
import { AgentType } from '@/lib/agents/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET — List all knowledge documents
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth || !auth.clientId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const clientId = auth.clientId;

  try {
    const documents = await listDocuments(clientId);
    return NextResponse.json({ documents });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — Create a new knowledge document
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth || !auth.clientId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const clientId = auth.clientId;

  try {
    const contentType = request.headers.get('content-type') || '';

    let name: string;
    let content: string;
    let description: string = '';
    let fileType: string = 'text';
    let agentTypes: AgentType[] = ['ADMIN', 'MARKETING', 'COMMERCIAL'];
    let structured: boolean = false;

    if (contentType.includes('multipart/form-data')) {
      // ─── File upload ─────────────────────────────────────────────────
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      name = (formData.get('name') as string) || file?.name || 'Document';
      description = (formData.get('description') as string) || '';
      structured = formData.get('structured') === 'true';

      const agentTypesStr = formData.get('agentTypes') as string;
      if (agentTypesStr) {
        agentTypes = agentTypesStr.split(',').map(s => s.trim()) as AgentType[];
      }

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }

      // Read file content
      const buffer = await file.arrayBuffer();
      const text = new TextDecoder('utf-8').decode(buffer);

      // Detect file type
      const ext = file.name.split('.').pop()?.toLowerCase() || 'txt';
      const typeMap: Record<string, string> = {
        txt: 'text', md: 'text', csv: 'csv', html: 'html', json: 'text',
        pdf: 'pdf', // PDF needs special handling — text extraction
      };
      fileType = typeMap[ext] || 'text';

      if (fileType === 'pdf') {
        return NextResponse.json(
          { error: 'PDF upload not yet supported. Please paste the text content instead.' },
          { status: 400 }
        );
      }

      content = text;
    } else {
      // ─── JSON body (paste text content) ──────────────────────────────
      const body = await request.json();
      name = body.name;
      content = body.content;
      description = body.description || '';
      fileType = body.fileType || 'text';
      structured = body.structured || false;

      if (body.agentTypes) {
        agentTypes = body.agentTypes;
      }

      if (!name || !content) {
        return NextResponse.json(
          { error: 'Missing required fields: name, content' },
          { status: 400 }
        );
      }
    }

    // Check document count limit (max 20 per client for now)
    const existing = await listDocuments(clientId);
    if (existing.length >= 20) {
      return NextResponse.json(
        { error: 'Limite de 20 documents atteinte. Supprimez un document existant.' },
        { status: 400 }
      );
    }

    // Check content size (max 100KB of text)
    if (content.length > 100_000) {
      return NextResponse.json(
        { error: 'Le document est trop volumineux (max 100 000 caractères).' },
        { status: 400 }
      );
    }

    // Ingest: create doc → chunk → embed → store
    const result = await ingestDocument(clientId, name, content, {
      description,
      fileType,
      agentTypes,
      structured,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      documentId: result.documentId,
      chunkCount: result.chunkCount,
      message: `Document "${name}" traité avec succès (${result.chunkCount} fragments créés).`,
    });
  } catch (err: any) {
    console.error('[Knowledge API] POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — Remove a document
export async function DELETE(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth || !auth.clientId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const clientId = auth.clientId;

  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('id');

    if (!documentId) {
      return NextResponse.json({ error: 'Missing document id' }, { status: 400 });
    }

    // Verify ownership
    const { data: doc } = await supabase
      .from('knowledge_documents')
      .select('client_id')
      .eq('id', documentId)
      .single();

    if (!doc || doc.client_id !== clientId) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    await deleteDocument(documentId);

    return NextResponse.json({ success: true, message: 'Document supprimé.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
