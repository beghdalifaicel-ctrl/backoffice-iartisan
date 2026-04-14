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

/**
 * Ensures the devis-pdfs bucket exists and is configured for public access
 * Call this once at app startup or on first use
 */
export async function ensureDevisBucket(): Promise<void> {
  try {
    // Try to get bucket info
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some((b) => b.name === BUCKET_NAME);

    if (exists) return;

    // Create bucket if it doesn't exist
    await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 10485760, // 10 MB
      allowedMimeTypes: ['application/pdf'],
    });

    console.log(`[Storage] Created bucket: ${BUCKET_NAME}`);
  } catch (err: any) {
    // Bucket might already exist, ignore gracefully
    if (!err.message?.includes('already exists')) {
      console.error('[Storage] Error ensuring bucket:', err);
    }
  }
}

/**
 * Upload a PDF to Supabase Storage
 * Returns a public URL for the document
 *
 * @param pdfBytes - PDF data as Uint8Array
 * @param filename - Filename (e.g., "DEV-2026-0001.pdf")
 * @returns Public URL of the uploaded file
 */
export async function uploadDevisPDF(
  pdfBytes: Uint8Array,
  filename: string
): Promise<string> {
  try {
    // Ensure bucket exists
    await ensureDevisBucket();

    // Generate unique path to avoid collisions
    const timestamp = Date.now();
    const filepath = `temp/${timestamp}_${filename}`;

    // Upload
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filepath, pdfBytes, {
        contentType: 'application/pdf',
        cacheControl: '3600', // 1 hour cache
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: publicUrl } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filepath);

    return publicUrl.publicUrl;
  } catch (err: any) {
    console.error('[Storage] PDF upload error:', err);
    throw err;
  }
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
