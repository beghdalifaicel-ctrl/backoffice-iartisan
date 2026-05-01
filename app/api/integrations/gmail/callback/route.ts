export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { exchangeGmailCode } from '@/lib/integrations/gmail';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state'); // clientId
  const error = request.nextUrl.searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      new URL(`/admin?gmail=error&message=${encodeURIComponent(error)}`, process.env.NEXT_PUBLIC_APP_URL!)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/admin?gmail=error&message=missing_params', process.env.NEXT_PUBLIC_APP_URL!)
    );
  }

  const result = await exchangeGmailCode(code, state);

  if (!result.success) {
    return NextResponse.redirect(
      new URL(`/admin?gmail=error&message=${encodeURIComponent(result.error || 'unknown')}`, process.env.NEXT_PUBLIC_APP_URL!)
    );
  }

  return NextResponse.redirect(
    new URL(`/admin?gmail=success&clientId=${state}`, process.env.NEXT_PUBLIC_APP_URL!)
  );
}
