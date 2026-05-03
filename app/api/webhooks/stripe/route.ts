export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { stripe, PLANS } from "@/lib/stripe";
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
      // ─── Paiement Payment Link initial → créer le client + premier message WhatsApp ───
      //
      // Pivot WhatsApp-first (01/05/2026) : l'inscription se fait via Stripe
      // Payment Links (champ téléphone obligatoire). Ce handler crée le Client
      // en DB s'il n'existe pas et déclenche le premier message Marie sur WhatsApp.
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (!customerId || !subscriptionId) {
          console.warn("[stripe.webhook] checkout.session.completed sans customer/subscription");
          break;
        }

        // 1. Récupérer les détails de la subscription pour identifier le plan
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = sub.items.data[0]?.price.id;
        let plan: "ESSENTIEL" | "PRO" | "MAX" = "ESSENTIEL";
        if (priceId === process.env.STRIPE_PRICE_PRO) plan = "PRO";
        if (priceId === process.env.STRIPE_PRICE_MAX) plan = "MAX";

        // 2. Récupérer le numéro de téléphone (champ obligatoire des Payment Links)
        const phone =
          session.customer_details?.phone ||
          (session.custom_fields?.find((f) => f.key === "phone")?.text?.value as string | undefined);

        const email = session.customer_details?.email || "";
        const fullName = session.customer_details?.name || "";
        const [firstName, ...rest] = fullName.split(" ");
        const lastName = rest.join(" ") || "";

        // 3. Créer ou mettre à jour le Client
        const existing = await prisma.client.findUnique({
          where: { stripeCustomerId: customerId },
        });

        let client;
        if (existing) {
          client = await prisma.client.update({
            where: { id: existing.id },
            data: {
              stripeSubscriptionId: subscriptionId,
              plan,
              status: "TRIAL",
              phone: phone || existing.phone,
              email: email || existing.email,
            },
          });
        } else if (email) {
          client = await prisma.client.create({
            data: {
              email,
              firstName: firstName || "Artisan",
              lastName,
              phone,
              company: fullName || "À compléter",
              metier: "À compléter",
              ville: "À compléter",
              plan,
              status: "TRIAL",
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
            },
          });
        } else {
          console.warn("[stripe.webhook] checkout.session.completed sans email — skip");
          break;
        }

        // 4. Notif admin
        await sendAdminNotification(`Nouvel abonnement - ${client.company}`, {
          title: "Nouveau client iArtisan via Payment Link",
          details: {
            "Client": `${client.firstName} ${client.lastName}`,
            "Email": client.email,
            "Téléphone": client.phone || "(non fourni)",
            "Plan": plan,
            "Subscription": subscriptionId,
          },
          ctaLabel: "Voir le client",
          ctaUrl: `https://app.iartisan.io/admin/clients`,
        });

        // 5. Déclencher le premier message WhatsApp signé Marie
        // (handler interne ; en cas d'échec on laisse passer — le matching auto
        // au premier message inbound de l'artisan prendra le relais)
        if (phone) {
          try {
            const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
            const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
            if (accessToken && phoneNumberId) {
              const PLAN_TEAM: Record<string, string> = {
                ESSENTIEL: "Je suis Marie, ton bras droit pour gérer ta présence Google.",
                PRO: "Je suis Marie. Avec Lucas (marketing), on s'occupe de ta visibilité en ligne.",
                MAX: "Je suis Marie. Avec Lucas (marketing) et Samir (commercial), on est l'équipe complète qui bosse pour toi.",
              };
              const welcome = `📋 Marie :\nBonjour ${client.firstName} ! ${PLAN_TEAM[plan]}\n\nDis-moi ce dont tu as besoin (devis, post Google, prospects...) et j'agis. Tu peux aussi m'envoyer une photo de chantier, je te génère un devis en 30 secondes.\n\nPour commencer : envoie-moi "aide" pour voir tout ce qu'on peut faire.`;

              await fetch(
                `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    messaging_product: "whatsapp",
                    to: phone.replace(/[^0-9]/g, ""),
                    type: "text",
                    text: { body: welcome },
                  }),
                }
              );
            }
          } catch (waErr: any) {
            console.error("[stripe.webhook] Premier message WhatsApp KO:", waErr.message);
          }
        }

        break;
      }

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
          const planNames: Record<string, string> = { ESSENTIEL: "Essentiel", PRO: "Pro", MAX: "Max" };
          const planPrices: Record<string, string> = { ESSENTIEL: "49", PRO: "99", MAX: "179" };
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
      // Stripe envoie ce webhook 3 jours avant la fin du trial. On l'utilise pour :
      //   1. Envoyer l'email de relance "votre essai se termine dans 3 jours"
      //   2. Ajouter le setup fee comme invoice item (facturé sur la 1ère vraie facture)
      //      → Stripe Checkout en mode subscription ne supporte pas add_invoice_items au signup,
      //        donc on l'attache ici, juste avant que la 1ère facture soit générée.
      case "customer.subscription.trial_will_end": {
        const sub = event.data.object as Stripe.Subscription;
        const trialClient = await prisma.client.findFirst({ where: { stripeSubscriptionId: sub.id } });
        if (trialClient) {
          const planNames: Record<string, string> = { ESSENTIEL: "Essentiel", PRO: "Pro", MAX: "Max" };
          await sendTrialEndingEmail(trialClient.email, {
            firstName: trialClient.firstName,
            daysLeft: 3,
            plan: planNames[trialClient.plan] || trialClient.plan,
          });

          // ─── Setup fee : attacher l'invoice item à la subscription ───
          const planKey = trialClient.plan as keyof typeof PLANS;
          const setupFee = PLANS[planKey]?.setup ?? 0;

          if (setupFee > 0 && trialClient.stripeCustomerId) {
            try {
              // Idempotence : ne pas re-créer si un invoice item setup_fee existe déjà
              // pour cette subscription (au cas où Stripe rejoue le webhook).
              const existing = await stripe.invoiceItems.list({
                customer: trialClient.stripeCustomerId,
                limit: 100,
                pending: true,
              });
              const alreadyAdded = existing.data.some(
                (it) => it.metadata?.kind === "setup_fee" && it.metadata?.subscription_id === sub.id
              );

              if (alreadyAdded) {
                console.log(`[webhook] Setup fee déjà attaché pour sub ${sub.id} — skip`);
              } else {
                const invoiceItem = await stripe.invoiceItems.create({
                  customer: trialClient.stripeCustomerId,
                  subscription: sub.id,
                  amount: setupFee,
                  currency: "eur",
                  description: `Frais de mise en service — Plan ${planNames[planKey] || planKey}`,
                  metadata: {
                    kind: "setup_fee",
                    plan: planKey,
                    client_id: trialClient.id,
                    subscription_id: sub.id,
                  },
                });
                console.log(
                  `[webhook] Setup fee ${setupFee}c attaché à sub ${sub.id} ` +
                  `(client ${trialClient.id}, item ${invoiceItem.id})`
                );

                // Notif admin
                await sendAdminNotification(`Setup fee attaché - ${trialClient.company}`, {
                  title: "Setup fee facturé sur la 1ère facture",
                  details: {
                    "Client": `${trialClient.firstName} ${trialClient.lastName}`,
                    "Entreprise": trialClient.company,
                    "Plan": planNames[planKey] || planKey,
                    "Montant setup": `${(setupFee / 100).toFixed(2)}€`,
                    "Subscription": sub.id,
                  },
                  ctaLabel: "Voir dans Stripe",
                  ctaUrl: `https://dashboard.stripe.com/subscriptions/${sub.id}`,
                });
              }
            } catch (feeErr: any) {
              // Ne pas faire planter le webhook si le setup fee échoue — on a au moins envoyé l'email.
              console.error(
                `[webhook] Erreur création setup fee pour sub ${sub.id}:`,
                feeErr.message
              );
              await sendAdminNotification(`⚠️ Setup fee KO - ${trialClient.company}`, {
                title: "Échec attachement setup fee",
                details: {
                  "Client": `${trialClient.firstName} ${trialClient.lastName}`,
                  "Subscription": sub.id,
                  "Erreur": feeErr.message,
                },
                ctaLabel: "Voir dans Stripe",
                ctaUrl: `https://dashboard.stripe.com/subscriptions/${sub.id}`,
              });
            }
          }
        }
        break;
      }

      // ─── Changement de plan ───
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const priceId = sub.items.data[0]?.price.id;

        // Détecter le plan
        let plan: "ESSENTIEL" | "PRO" | "MAX" = "ESSENTIEL";
        if (priceId === process.env.STRIPE_PRICE_PRO) plan = "PRO";
        if (priceId === process.env.STRIPE_PRICE_MAX) plan = "MAX";

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
