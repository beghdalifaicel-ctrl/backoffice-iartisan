/**
 * PDF Storage Helper — Supabase Storage Management
 *
 * Manages PDF uploads/downloads for devis and factures
 * Uses Supabase Storage public bucket for temporary document access
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET_NAME = 'devis-pdfs';
const BUCKET_TEMP_RETENTION = 86400 * 3; // 3 days in seconds

// MIME types autorisés dans le bucket (PDF + formats modifiables Word/Excel).
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
];

/**
 * Ensures the devis-pdfs bucket exists AND has the right MIME types policy.
 * Le bucket accepte PDF + DOCX + XLSX (formats modifiables que Marie peut envoyer
 * sur demande pour que l'artisan finalise dans son outil).
 *
 * Si le bucket existe déjà mais avec une policy obsolète (ex: créé avant
 * l'ajout de DOCX/XLSX), on le met à jour automatiquement via updateBucket.
 */
export async function ensureDevisBucket(): Promise<void> {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const existing = buckets?.find((b) => b.name === BUCKET_NAME);

    if (!existing) {
      await supabase.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: 10485760, // 10 MB
        allowedMimeTypes: ALLOWED_MIME_TYPES,
      });
      console.log(`[Storage] Created bucket: ${BUCKET_NAME}`);
      return;
    }

    // Bucket existe — vérifier que la policy MIME types est à jour.
    // Note : l'API listBuckets ne renvoie pas allowed_mime_types, donc on
    // appelle updateBucket de manière idempotente : si la policy est déjà
    // bonne, ça ne fait rien de visible.
    await supabase.storage.updateBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 10485760,
      allowedMimeTypes: ALLOWED_MIME_TYPES,
    });
  } catch (err: any) {
    if (!err.message?.includes('already exists')) {
      console.error('[Storage] Error ensuring bucket:', err);
    }
  }
}

/**
 * Upload arbitrary devis bytes (PDF / DOCX / XLSX) to Supabase Storage.
 *
 * @param bytes - File bytes as Uint8Array
 * @param filename - Filename (e.g., "DEV-2026-0001.pdf" or ".docx" or ".xlsx")
 * @param contentType - MIME type. Defaults to PDF.
 * @returns Public URL of the uploaded file
 */
export async function uploadDevisFile(
  bytes: Uint8Array,
  filename: string,
  contentType:
    | 'application/pdf'
    | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' = 'application/pdf'
): Promise<string> {
  try {
    await ensureDevisBucket();

    const timestamp = Date.now();
    const filepath = `temp/${timestamp}_${filename}`;

    const { error } = await supabase.storage.from(BUCKET_NAME).upload(filepath, bytes, {
      contentType,
      cacheControl: '3600',
    });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    const { data: publicUrl } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filepath);
    return publicUrl.publicUrl;
  } catch (err: any) {
    console.error('[Storage] Upload error:', err);
    throw err;
  }
}

/**
 * Upload a PDF to Supabase Storage. Backward-compatible wrapper around
 * uploadDevisFile() — keep using it for PDF flows.
 */
export async function uploadDevisPDF(
  pdfBytes: Uint8Array,
  filename: string
): Promise<string> {
  return uploadDevisFile(pdfBytes, filename, 'application/pdf');
}

/**
 * Delete a PDF from storage (cleanup after 3 days or on demand)
 *
 * @param url - Public URL of the file
 */
export async function deleteDevisPDF(url: string): Promise<void> {
  try {
    // Extract filepath from URL
    // URL format: https://[project].supabase.co/storage/v1/object/public/devis-pdfs/temp/...
    const pathMatch = url.match(/devis-pdfs\/(.+)$/);
    if (!pathMatch) return;

    const filepath = pathMatch[1];

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filepath]);

    if (error) {
      console.warn('[Storage] Failed to delete PDF:', error);
      return;
    }

    console.log(`[Storage] Deleted: ${filepath}`);
  } catch (err: any) {
    console.error('[Storage] PDF deletion error:', err);
  }
}

/**
 * Schedule automatic cleanup of old PDFs (3 days old)
 * This should be called periodically (e.g., via cron job)
 */
export async function cleanupOldPDFs(): Promise<number> {
  try {
    // List all files in temp directory
    const { data: files, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list('temp');

    if (error) {
      console.error('[Storage] Cleanup error listing files:', error);
      return 0;
    }

    if (!files) return 0;

    const now = Date.now();
    let deletedCount = 0;

    // Check age and delete if older than 3 days
    for (const file of files) {
      const createdAt = new Date(file.created_at || Date.now()).getTime();
      const ageMs = now - createdAt;
      const ageSeconds = Math.floor(ageMs / 1000);

      if (ageSeconds > BUCKET_TEMP_RETENTION) {
        const filepath = `temp/${file.name}`;
        const { error: delError } = await supabase.storage
          .from(BUCKET_NAME)
          .remove([filepath]);

        if (!delError) {
          deletedCount++;
        }
      }
    }

    console.log(`[Storage] Cleanup: deleted ${deletedCount} old PDFs`);
    return deletedCount;
  } catch (err: any) {
    console.error('[Storage] Cleanup error:', err);
    return 0;
  }
}

/**
 * Check if a file exists and is accessible
 *
 * @param url - Public URL to check
 */
export async function checkPDFExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}
