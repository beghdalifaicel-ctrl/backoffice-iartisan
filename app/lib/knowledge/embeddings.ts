/**
 * Embeddings module — Mistral Embed API
 *
 * Uses mistral-embed (1024 dimensions) for vector embeddings.
 * Handles text chunking, embedding generation, and batch processing.
 */

const MISTRAL_EMBED_MODEL = 'mistral-embed';
const EMBED_DIMENSIONS = 1024;
const MAX_TOKENS_PER_CHUNK = 512;   // ~2000 chars per chunk
const CHUNK_OVERLAP_CHARS = 200;     // Overlap between chunks for continuity
const MAX_BATCH_SIZE = 25;           // Mistral embed API batch limit

// ─── Chunking ───────────────────────────────────────────────────────────────

export interface TextChunk {
  content: string;
  index: number;
  tokenCount: number;
  metadata: {
    section?: string;
    pageNumber?: number;
    startChar: number;
    endChar: number;
  };
}

/**
 * Split text into overlapping chunks suitable for embedding.
 * Strategy: split by paragraphs first, then by sentences, then by char limit.
 */
export function chunkText(
  text: string,
  options: {
    maxChunkChars?: number;
    overlapChars?: number;
    sectionTitle?: string;
  } = {}
): TextChunk[] {
  const maxChars = options.maxChunkChars || MAX_TOKENS_PER_CHUNK * 4; // ~4 chars per token
  const overlap = options.overlapChars || CHUNK_OVERLAP_CHARS;

  // Clean the text
  const cleaned = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!cleaned) return [];

  // If text is small enough, return as single chunk
  if (cleaned.length <= maxChars) {
    return [{
      content: cleaned,
      index: 0,
      tokenCount: estimateTokens(cleaned),
      metadata: {
        section: options.sectionTitle,
        startChar: 0,
        endChar: cleaned.length,
      },
    }];
  }

  // Split into paragraphs
  const paragraphs = cleaned.split(/\n\n+/);
  const chunks: TextChunk[] = [];
  let currentChunk = '';
  let chunkStart = 0;
  let charOffset = 0;

  for (const para of paragraphs) {
    // If adding this paragraph exceeds limit, save current chunk and start new one
    if (currentChunk.length + para.length + 2 > maxChars && currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        index: chunks.length,
        tokenCount: estimateTokens(currentChunk),
        metadata: {
          section: options.sectionTitle,
          startChar: chunkStart,
          endChar: chunkStart + currentChunk.length,
        },
      });

      // Start new chunk with overlap from end of previous
      const overlapText = currentChunk.slice(-overlap);
      chunkStart = chunkStart + currentChunk.length - overlapText.length;
      currentChunk = overlapText + '\n\n';
    }

    // If single paragraph is too long, split by sentences
    if (para.length > maxChars) {
      const sentences = splitBySentences(para);
      for (const sentence of sentences) {
        if (currentChunk.length + sentence.length + 1 > maxChars && currentChunk.length > 0) {
          chunks.push({
            content: currentChunk.trim(),
            index: chunks.length,
            tokenCount: estimateTokens(currentChunk),
            metadata: {
              section: options.sectionTitle,
              startChar: chunkStart,
              endChar: chunkStart + currentChunk.length,
            },
          });
          const overlapText = currentChunk.slice(-overlap);
          chunkStart = chunkStart + currentChunk.length - overlapText.length;
          currentChunk = overlapText + ' ';
        }
        currentChunk += sentence + ' ';
      }
    } else {
      currentChunk += para + '\n\n';
    }

    charOffset += para.length + 2;
  }

  // Don't forget the last chunk
  if (currentChunk.trim().length > 50) { // Minimum 50 chars to avoid tiny chunks
    chunks.push({
      content: currentChunk.trim(),
      index: chunks.length,
      tokenCount: estimateTokens(currentChunk),
      metadata: {
        section: options.sectionTitle,
        startChar: chunkStart,
        endChar: chunkStart + currentChunk.length,
      },
    });
  }

  return chunks;
}

/**
 * Split text into structured chunks by detecting sections (headers, numbered items).
 * Better for structured documents like tariff grids, FAQs, etc.
 */
export function chunkStructuredText(text: string): TextChunk[] {
  const maxChars = MAX_TOKENS_PER_CHUNK * 4;
  const lines = text.split('\n');
  const chunks: TextChunk[] = [];
  let currentChunk = '';
  let currentSection = '';
  let charOffset = 0;

  for (const line of lines) {
    // Detect section headers (markdown-style, numbered, or ALL CAPS)
    const isHeader = /^#{1,3}\s/.test(line) ||
                     /^\d+[\.\)]\s+[A-Z]/.test(line) ||
                     (line === line.toUpperCase() && line.length > 5 && line.length < 80);

    if (isHeader && currentChunk.length > 100) {
      // Save current chunk with its section
      chunks.push({
        content: currentChunk.trim(),
        index: chunks.length,
        tokenCount: estimateTokens(currentChunk),
        metadata: {
          section: currentSection || undefined,
          startChar: charOffset - currentChunk.length,
          endChar: charOffset,
        },
      });
      currentChunk = '';
      currentSection = line.replace(/^#{1,3}\s*/, '').trim();
    }

    currentChunk += line + '\n';
    charOffset += line.length + 1;

    // Force split if chunk is too long
    if (currentChunk.length > maxChars) {
      chunks.push({
        content: currentChunk.trim(),
        index: chunks.length,
        tokenCount: estimateTokens(currentChunk),
        metadata: {
          section: currentSection || undefined,
          startChar: charOffset - currentChunk.length,
          endChar: charOffset,
        },
      });
      currentChunk = '';
    }
  }

  if (currentChunk.trim().length > 50) {
    chunks.push({
      content: currentChunk.trim(),
      index: chunks.length,
      tokenCount: estimateTokens(currentChunk),
      metadata: {
        section: currentSection || undefined,
        startChar: charOffset - currentChunk.length,
        endChar: charOffset,
      },
    });
  }

  return chunks;
}

// ─── Embeddings ─────────────────────────────────────────────────────────────

/**
 * Generate embeddings for an array of texts using Mistral Embed API.
 * Returns 1024-dimensional vectors.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error('MISTRAL_API_KEY not configured');

  if (texts.length === 0) return [];

  // Process in batches
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
    const batch = texts.slice(i, i + MAX_BATCH_SIZE);

    const response = await fetch('https://api.mistral.ai/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MISTRAL_EMBED_MODEL,
        input: batch,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Mistral Embed API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    const embeddings = data.data
      .sort((a: any, b: any) => a.index - b.index)
      .map((item: any) => item.embedding);

    allEmbeddings.push(...embeddings);
  }

  return allEmbeddings;
}

/**
 * Generate a single embedding for a query (used at search time).
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const embeddings = await generateEmbeddings([query]);
  return embeddings[0];
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function splitBySentences(text: string): string[] {
  // French-aware sentence splitting
  return text
    .split(/(?<=[.!?])\s+(?=[A-ZÀ-ÿ])/)
    .filter(s => s.length > 0);
}

function estimateTokens(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters for French text
  return Math.ceil(text.length / 4);
}

export { EMBED_DIMENSIONS, MAX_TOKENS_PER_CHUNK };
