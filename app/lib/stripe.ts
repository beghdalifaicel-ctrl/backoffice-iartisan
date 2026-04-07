import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10",
});

// Prix par offre iArtisan
export const PLANS = {
  ESSENTIEL: {
    name: "Essentiel",
    price: 4900, // centimes
    priceId: process.env.STRIPE_PRICE_ESSENTIEL!,
    setup: 5000,
    features: [
      "Fiche Google créée et optimisée",
      "Posts Google hebdomadaires auto",
      "Réponses aux avis par IA",
      "Devis/factures WhatsApp vocal",
      "Tableau de bord mensuel",
    ],
  },
  CROISSANCE: {
    name: "Pro",
    price: 9900,
    priceId: process.env.STRIPE_PRICE_CROISSANCE!,
    setup: 0,
    features: [
      "Tout Essentiel +",
      "Site vitrine SEO 5 pages",
      "Alertes leads WhatsApp temps réel",
      "Relances impayés automatiques",
      "Support prioritaire 6j/7",
    ],
  },
  PILOTE_AUTO: {
    name: "Max",
    price: 17900,
    priceId: process.env.STRIPE_PRICE_PILOTE_AUTO!,
    setup: 0,
    features: [
      "Tout Pro +",
      "Site 10 pages + blog SEO mensuel",
      "Gestion avis Facebook/Instagram",
      "Rapports hebdomadaires",
      "Conseiller dédié 24h/7j",
    ],
  },
} as const;

// Créer un client Stripe + abonnement
export async function createSubscription(
  email: string,
  name: string,
  plan: keyof typeof PLANS
) {
  const customer = await stripe.customers.create({ email, name });

  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: PLANS[plan].priceId }],
    trial_period_days: 14,
    payment_behavior: "default_incomplete",
    expand: ["latest_invoice.payment_intent"],
  });

  return { customerId: customer.id, subscription };
}
