/**
 * Test endpoint pour isoler l'envoi Resend (debug only).
 * Hit avec : curl https://app.iartisan.io/api/test-email?token=<TOKEN>
 *
 * Loggue le résultat brut Resend dans Vercel logs pour voir le vrai message
 * d'erreur (domain_not_verified, invalid_to_address, validation_error, etc.).
 */

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const adminEmail = process.env.ADMIN_EMAIL || 'faicel@iartisan.io';
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'iArtisan <noreply@iartisan.io>';
  const apiKey = process.env.RESEND_API_KEY || '';

  console.log(`[TEST-EMAIL] Starting | from="${fromEmail}" | to="${adminEmail}" | apiKey=${apiKey ? `set(${apiKey.slice(0, 6)}…${apiKey.slice(-4)})` : 'MISSING'}`);

  if (!apiKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY missing' }, { status: 500 });
  }

  const resend = new Resend(apiKey);

  try {
    const result: any = await resend.emails.send({
      from: fromEmail,
      to: adminEmail,
      subject: '[TEST] iArtisan email diagnostic',
      html: '<p>Test diagnostic Resend — si tu reçois ça, la chaîne fonctionne.</p>',
    });

    console.log(`[TEST-EMAIL] Raw Resend response:`, JSON.stringify(result));

    if (result?.error) {
      return NextResponse.json({
        ok: false,
        from: fromEmail,
        to: adminEmail,
        resendError: result.error,
      });
    }

    return NextResponse.json({
      ok: true,
      from: fromEmail,
      to: adminEmail,
      messageId: result?.data?.id,
      raw: result,
    });
  } catch (err: any) {
    console.error('[TEST-EMAIL] Throw:', err);
    return NextResponse.json({
      ok: false,
      thrown: true,
      message: err?.message || String(err),
      stack: err?.stack,
    });
  }
}
