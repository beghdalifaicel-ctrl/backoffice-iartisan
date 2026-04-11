import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import Stripe from "stripe";
import { sendSubscriptionActiveEmail, sendTrialEndingEmail, sendAdminNotification, sendPaymentReminderEmail } from "@/lib/email";

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

          // Email de confirmation d'abonnement au client
          const planNames: Record<string, string> = { ESSENTIEL: "Essentiel", CROISSANCE: "Pro", PILOTE_AUTO: "Max" };
          const planPrices: Record<string, string> = { ESSENTIEL: "49", CROISSANCE: "99", PILOTE_AUTO: "179" };
          await sendSubscriptionActiveEmail(client.email, {
            firstName: client.firstName,
            plan: planNames[client.plan] || client.plan,
            amount: planPrices[client.plan] || "49",
          });

          // Notification admin
          await sendAdminNotification(`Paiement reçu - ${client.company}`, {
            title: "Nouveau paiement Stripe",
            details: {
              "Client": `${client.firstName} ${client.lastName}`,
              "Entreprise": client.company,
              "Montant": `${(invoice.amount_paid / 100).toFixed(2)}€`,
              "Plan": planNames[client.plan] || client.plan,
            },
            ctaLabel: "Voir le dashboard",
            ctaUrl: "https://app.iartisan.io/admin",
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

        // Alerte admin
        const failedClient = await prisma.client.findFirst({ where: { stripeCustomerId: invoice.customer as string } });
        if (failedClient) {
          await sendAdminNotification(`Paiement échoué - ${failedClient.company}`, {
            title: "Paiement Stripe échoué",
            details: {
              "Client": `${failedClient.firstName} ${failedClient.lastName}`,
              "Email": failedClient.email,
              "Montant": `${(invoice.amount_due / 100).toFixed(2)}€`,
            },
            ctaLabel: "Voir dans Stripe",
            ctaUrl: `https://dashboard.stripe.com/invoices/${invoice.id}`,
          });
        }
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

      // ─── Essai terminé (J-3) ───
      case "customer.subscription.trial_will_end": {
        const sub = event.data.object as Stripe.Subscription;
        const trialClient = await prisma.client.findFirst({ where: { stripeSubscriptionId: sub.id } });
        if (trialClient) {
          const planNames: Record<string, string> = { ESSENTIEL: "Essentiel", CROISSANCE: "Pro", PILOTE_AUTO: "Max" };
          await sendTrialEndingEmail(trialClient.email, {
            firstName: trialClient.firstName,
            daysLeft: 3,
            plan: planNames[trialClient.plan] || trialClient.plan,
          });
        }
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
