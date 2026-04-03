import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import Stripe from "stripe";

// Désactiver le body parsing Next.js (Stripe a besoin du raw body)
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      // ─── Paiement réussi → activer le client ───
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        // Mettre à jour le statut du client
        await prisma.client.updateMany({
          where: { stripeCustomerId: customerId },
          data: { status: "ACTIVE" },
        });

        // Créer la facture en base
        const client = await prisma.client.findFirst({ where: { stripeCustomerId: customerId } });
        if (client) {
          const count = await prisma.invoice.count();
          await prisma.invoice.create({
            data: {
              number: `FAC-${new Date().getFullYear()}-${String(count + 1).padStart(3, "0")}`,
              amount: invoice.amount_paid,
              status: "PAID",
              paidAt: new Date(),
              stripeInvoiceId: invoice.id,
              stripePaymentUrl: invoice.hosted_invoice_url || null,
              clientId: client.id,
            },
          });
        }
        break;
      }

      // ─── Paiement échoué → marquer en retard ───
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await prisma.client.updateMany({
          where: { stripeCustomerId: invoice.customer as string },
          data: { status: "PAST_DUE" },
        });
        break;
      }

      // ─── Abonnement annulé → churn ───
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await prisma.client.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: { status: "CHURNED" },
        });
        break;
      }

      // ─── Essai terminé ───
      case "customer.subscription.trial_will_end": {
        const sub = event.data.object as Stripe.Subscription;
        // TODO: Envoyer un email / WhatsApp de rappel au client
        console.log(`Trial ending soon for subscription: ${sub.id}`);
        break;
      }

      // ─── Changement de plan ───
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const priceId = sub.items.data[0]?.price.id;

        // Détecter le plan
        let plan: "ESSENTIEL" | "CROISSANCE" | "PILOTE_AUTO" = "ESSENTIEL";
        if (priceId === process.env.STRIPE_PRICE_CROISSANCE) plan = "CROISSANCE";
        if (priceId === process.env.STRIPE_PRICE_PILOTE_AUTO) plan = "PILOTE_AUTO";

        await prisma.client.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: { plan },
        });
        break;
      }
    }
  } catch (error) {
    console.error("Erreur traitement webhook:", error);
    return NextResponse.json({ error: "Erreur traitement" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
