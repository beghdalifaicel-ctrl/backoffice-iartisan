import { NextRequest, NextResponse } from 'next/server';
import { processTaskQueue, recoverStaleTasks } from '@/lib/agents/worker';

// This endpoint is called by Vercel Cron or an external scheduler
// Vercel cron config in vercel.json: { "crons": [{ "path": "/api/agents/worker", "schedule": "* * * * *" }] }

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Verify cron authentication
  // Vercel Cron sends a special header but doesn't send Authorization
  // For security, we also accept Bearer token for manual testing
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Check if this is a Vercel Cron request or has valid Bearer token
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  const hasValidAuth = authHeader === `Bearer ${cronSecret}`;

  // Only allow Vercel Cron (verified by Vercel) or requests with correct Bearer token
  if (!isVercelCron && !hasValidAuth) {
    return NextResponse.json(
      { error: 'Unauthorized', timestamp: new Date().toISOString() },
      { status: 401 }
    );
  }

  try {
    // Process pending tasks
    const processed = await processTaskQueue();

    // Recover stale tasks (stuck in PROCESSING for > 10 minutes)
    const recovered = await recoverStaleTasks();

    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      ok: true,
      processed,
      recovered,
      durationMs,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    const durationMs = Date.now() - startTime;

    return NextResponse.json(
      {
        ok: false,
        error: err.message || 'Unknown error',
        durationMs,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const maxDuration = 60; // 60s max for Vercel Pro
