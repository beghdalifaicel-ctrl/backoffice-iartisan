import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { createToken } from "@/lib/auth";
import { sendWelcomeEmail } from "@/lib/email";

// GET /api/client/auth/stripe-callback — Stripe Checkout success redirect
// Sets the JWT cookie and redirects to onboarding
export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.iartisan.io";

  try {
    const sessionId = req.nextUrl.searchParams.get("session_id");
    const clientId = req.nextUrl.searchParams.get("client_id");

    if (!sessionId || !clientId) {
      return NextResponse.redirect(`${appUrl}/client/login?error=missing_params`);
    }

    // Verify the Stripe Checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid" && session.status !== "complete") {
      // Trial subscriptions may not have payment_status = paid
      // Check if subscription was created
      if (!session.subscription) {
        return NextResponse.redirect(`${appUrl}/client/signup?error=payment_failed`);
      }
    }

    // Get the client
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return NextResponse.redirect(`${appUrl}/client/login?error=client_not_found`);
    }

    // Update client with Stripe subscription ID if not already set
    if (session.subscription) {
      await prisma.client.update({
        where: { id: clientId },
        data: {
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
        },
      });
    }

    // Send welcome email
    try {
      await sendWelcomeEmail(client.email, {
        firstName: client.firstName,
        tempPassword: "", // User chose their own password
        plan: client.plan,
      });
    } catch {
      // Email is non-blocking
    }

    // Create JWT token and set cookie
    const token = await createToken({
      email: client.email,
      role: "client",
      clientId: client.id,
    });

    const res = NextResponse.redirect(`${appUrl}/client/onboarding`);
    res.cookies.set("ia-session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 jours
      path: "/",
    });

    return res;
  } catch (error: any) {
    console.error("Stripe callback error:", error);
    return NextResponse.redirect(`${appUrl}/client/login?error=callback_failed`);
  }
}
