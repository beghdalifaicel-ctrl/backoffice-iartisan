/**
 * RAG (Retrieval-Augmented Generation) module
 *
 * Handles:
 * - Semantic search across client's knowledge base
 * - Context assembly with token budget management
 * - Document processing pipeline (upload → chunk → embed → store)
 */

import { createClient } from '@supabase/supabase-js';
import {
  generateEmbeddings,
  generateQueryEmbedding,
  chunkText,
  chunkStructuredText,
  TextChunk,
} from './embeddings';
import { AgentType } from '../agents/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Types ──────────────────────────────────────────────────────────────────

export interface KnowledgeDocument {
  id: string;
  clientId: string;
  name: string;
  description: string;
  fileType: string;
  agentTypes: AgentType[];
  status: string;
  chunkCount: number;
  createdAt: string;
}

export interface SearchResult {
  id: string;
  documentId: string;
  content: string;
  metadata: Record<string, any>;
  similarity: number;
  documentName: string;
  tokenCount: number;
}

export interface RAGContext {
  chunks: SearchResult[];
  totalTokens: number;
  sources: string[];
}

// ─── Semantic Search ────────────────────────────────────────────────────────

/**
 * Search the client's knowledge base for relevant context.
 * Returns ranked chunks within the token budget.
 */
export async function searchKnowledge(
  clientId: string,
  agentType: AgentType,
  query: string,
  options: {
    maxResults?: number;
    maxTokens?: number;           // Token budget for context window
    minSimilarity?: number;
  } = {}
): Promise<RAGContext> {
  const {
    maxResults = 8,
    maxTokens = 2000,             // ~8000 chars of context
    minSimilarity = 0.3,
  } = options;

  try {
    // 1. Generate query embedding
    const queryEmbedding = await generateQueryEmbedding(query);

    // 2. Search via Supabase RPC (vector similarity)
    const { data: results, error } = await supabase.rpc('search_knowledge', {
      p_client_id: clientId,
      p_agent_type: agentType,
      p_query_embedding: JSON.stringify(queryEmbedding),
      p_match_count: maxResults,
      p_match_threshold: minSimilarity,
    });

    if (error) {
      console.error('[RAG] Search error:', error);
      return { chunks: [], totalTokens: 0, sources: [] };
    }

    if (!results || results.length === 0) {
      return { chunks: [], totalTokens: 0, sources: [] };
    }

    // 3. Apply token budget — include chunks until we exceed the budget
    const selectedChunks: SearchResult[] = [];
    let totalTokens = 0;
    const sources = new Set<string>();

    for (const result of results) {
      const chunkTokens = result.token_count || Math.ceil(result.content.length / 4);
      if (totalTokens + chunkTokens > maxTokens && selectedChunks.length > 0) {
        break; // Budget exceeded
      }

      selectedChunks.push({
        id: result.id,
        documentId: result.document_id,
        content: result.content,
        metadata: result.metadata || {},
        similarity: result.similarity,
        documentName: result.document_name,
        tokenCount: chunkTokens,
      });

      totalTokens += chunkTokens;
      sources.add(result.document_name);
    }

    return {
      chunks: selectedChunks,
      totalTokens,
      sources: Array.from(sources),
    };
  } catch (err: any) {
    console.error('[RAG] Search failed:', err.message);
    return { chunks: [], totalTokens: 0, sources: [] };
  }
}

/**
 * Format RAG context for injection into the system prompt.
 * Creates a structured "knowledge" block that the LLM can reference.
 */
export function formatRAGContext(ragContext: RAGContext): string {
  if (ragContext.chunks.length === 0) return '';

  let context = '\n\n--- BASE DE CONNAISSANCE ---\n';
  context += 'Utilise ces informations pour répondre de manière précise et personnalisée.\n';
  context += 'Si l\'information n\'est pas dans la base, dis-le clairement.\n\n';

  // Group by document
  const byDocument = new Map<string, SearchResult[]>();
  for (const chunk of ragContext.chunks) {
    const docName = chunk.documentName;
    if (!byDocument.has(docName)) byDocument.set(docName, []);
    byDocument.get(docName)!.push(chunk);
  }

  byDocument.forEach((chunks, docName) => {
    context += `📄 ${docName}:\n`;
    for (const chunk of chunks) {
      const section = chunk.metadata?.section ? ` [${chunk.metadata.section}]` : '';
      context += `${chunk.content}${section}\n\n`;
    }
  });

  context += '--- FIN BASE DE CONNAISSANCE ---\n';
  return context;
}

// ─── Document Processing Pipeline ───────────────────────────────────────────

/**
 * Process a document: chunk it, generate embeddings, store in Supabase.
 * This is the main ingestion pipeline.
 */
export async function processDocument(
  documentId: string,
  content: string,
  options: {
    structured?: boolean;    // Use structured chunking (headers, sections)
    clientId: string;
    agentTypes: AgentType[];
  }
): Promise<{ chunkCount: number; error?: string }> {
  try {
    // 1. Update status to PROCESSING
    await supabase
      .from('knowledge_documents')
      .update({ status: 'PROCESSING', updated_at: new Date().toISOString() })
      .eq('id', documentId);

    // 2. Chunk the text
    const chunks: TextChunk[] = options.structured
      ? chunkStructuredText(content)
      : chunkText(content);

    if (chunks.length === 0) {
      await supabase
        .from('knowledge_documents')
        .update({ status: 'ERROR', error: 'No content to process', updated_at: new Date().toISOString() })
        .eq('id', documentId);
      return { chunkCount: 0, error: 'No content to process' };
    }

    // 3. Generate embeddings for all chunks
    const texts = chunks.map(c => c.content);
    const embeddings = await generateEmbeddings(texts);

    // 4. Delete any existing chunks for this document (re-processing)
    await supabase
      .from('knowledge_chunks')
      .delete()
      .eq('document_id', documentId);

    // 5. Insert chunks with embeddings in batches
    const batchSize = 50;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const batchEmbeddings = embeddings.slice(i, i + batchSize);

      const rows = batch.map((chunk, j) => ({
        document_id: documentId,
        client_id: options.clientId,
        content: chunk.content,
        chunk_index: chunk.index,
        agent_types: options.agentTypes,
        metadata: chunk.metadata,
        embedding: JSON.stringify(batchEmbeddings[j]),
        token_count: chunk.tokenCount,
      }));

      const { error: insertError } = await supabase
        .from('knowledge_chunks')
        .insert(rows);

      if (insertError) {
        throw new Error(`Failed to insert chunks batch ${i}: ${insertError.message}`);
      }
    }

    // 6. Update document status
    await supabase
      .from('knowledge_documents')
      .update({
        status: 'READY',
        chunk_count: chunks.length,
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    return { chunkCount: chunks.length };
  } catch (err: any) {
    console.error(`[RAG] Document processing failed for ${documentId}:`, err.message);

    await supabase
      .from('knowledge_documents')
      .update({
        status: 'ERROR',
        error: err.message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    return { chunkCount: 0, error: err.message };
  }
}

/**
 * Create a new knowledge document and start processing it.
 */
export async function ingestDocument(
  clientId: string,
  name: string,
  content: string,
  options: {
    description?: string;
    fileType?: string;
    agentTypes?: AgentType[];
    structured?: boolean;
  } = {}
): Promise<{ documentId: string; chunkCount: number; error?: string }> {
  const agentTypes = options.agentTypes || ['ADMIN', 'MARKETING', 'COMMERCIAL'];

  // 1. Create document record
  const { data: doc, error } = await supabase
    .from('knowledge_documents')
    .insert({
      client_id: clientId,
      name,
      description: options.description || '',
      file_type: options.fileType || 'text',
      agent_types: agentTypes,
      status: 'PENDING',
      content_hash: simpleHash(content),
    })
    .select('id')
    .single();

  if (error || !doc) {
    return { documentId: '', chunkCount: 0, error: error?.message || 'Failed to create document' };
  }

  // 2. Process (chunk + embed + store)
  const result = await processDocument(doc.id, content, {
    clientId,
    agentTypes,
    structured: options.structured,
  });

  return { documentId: doc.id, ...result };
}

/**
 * Delete a document and all its chunks.
 */
export async function deleteDocument(documentId: string): Promise<void> {
  // Chunks are CASCADE deleted via FK
  await supabase
    .from('knowledge_documents')
    .delete()
    .eq('id', documentId);
}

/**
 * List all documents for a client.
 */
export async function listDocuments(clientId: string): Promise<KnowledgeDocument[]> {
  const { data } = await supabase
    .from('knowledge_documents')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  return (data || []).map((d: any) => ({
    id: d.id,
    clientId: d.client_id,
    name: d.name,
    description: d.description || '',
    fileType: d.file_type,
    agentTypes: d.agent_types,
    status: d.status,
    chunkCount: d.chunk_count || 0,
    createdAt: d.created_at,
  }));
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function simpleHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString(36);
}
