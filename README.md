# iArtisan Back-Office

Back-office d'administration pour **iArtisan.io** — gestion des clients artisans, leads, abonnements Stripe, factures et KPIs en temps réel.

## Stack technique

- **Next.js 14** (App Router, TypeScript)
- **Prisma** + PostgreSQL (Supabase)
- **Stripe** (abonnements, webhooks, factures)
- **Tailwind CSS** (design tokens iArtisan)
- **Recharts** (graphiques)
- **Jose** (auth JWT)

---

## 1. Créer la base de données (Supabase)

1. Aller sur [supabase.com](https://supabase.com) → créer un nouveau projet
2. Copier la **Connection String** (Settings > Database > URI)
   - Format : `postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres`

---

## 2. Créer les produits Stripe

Dans le **Dashboard Stripe** (mode Test d'abord) :

1. Aller dans **Produits** → créer 3 produits :

   | Produit       | Prix mensuel | Prix ID (à copier) |
   |---------------|-------------|---------------------|
   | Essentiel     | 49,00 €/mois | `price_xxx...`     |
   | Pro    | 99,00 €/mois | `price_xxx...`     |
   | Max   | 179,00 €/mois | `price_xxx...`    |

2. Chaque produit = tarification **récurrente mensuelle**

3. Copier le **Price ID** de chacun (commence par `price_`)

---

## 3. Configurer le webhook Stripe

1. Stripe Dashboard → **Développeurs** → **Webhooks**
2. Ajouter un endpoint : `https://VOTRE-DOMAINE.vercel.app/api/webhooks/stripe`
3. Sélectionner les événements :
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`
   - `customer.subscription.trial_will_end`
4. Copier le **Webhook Secret** (commence par `whsec_`)

---

## 4. Générer le hash du mot de passe admin

```bash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('VOTRE_MOT_DE_PASSE', 12).then(h => console.log(h))"
```

Copier le hash qui ressemble à : `$2a$12$...`

---

## 5. Variables d'environnement

Créer un fichier `.env` à la racine (ou configurer dans Vercel) :

```env
# Base de données
DATABASE_URL="postgresql://postgres:PASSWORD@db.REF.supabase.co:5432/postgres"

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRICE_ESSENTIEL="price_..."
STRIPE_PRICE_PRO="price_..."
STRIPE_PRICE_MAX="price_..."

# Auth Admin
ADMIN_EMAIL="faicel@iartisan.io"
ADMIN_PASSWORD_HASH="$2a$12$..."
JWT_SECRET="une-chaine-aleatoire-longue-et-unique"

# URLs
NEXT_PUBLIC_APP_URL="https://admin.iartisan.io"
NEXT_PUBLIC_SITE_URL="https://iartisan.io"
```

---

## 6. Installation locale

```bash
# Installer les dépendances
npm install

# Pousser le schéma en base
npx prisma db push

# Générer le client Prisma
npx prisma generate

# Lancer en dev
npm run dev
```

L'app tourne sur `http://localhost:3000` → redirige vers `/login`.

---

## 7. Déployer sur Vercel

1. Push le projet sur GitHub
2. Aller sur [vercel.com](https://vercel.com) → **Import Project** depuis le repo
3. Ajouter toutes les variables d'environnement (section 5)
4. Vercel détecte automatiquement Next.js → **Deploy**
5. Après le déploiement, mettre à jour l'URL du webhook Stripe (section 3)

---

## 8. Connecter le formulaire iartisan.io

Sur la page d'inscription de iartisan.io, envoyer les leads vers l'API :

```javascript
const response = await fetch("https://VOTRE-DOMAINE.vercel.app/api/leads", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    firstName: "Jean",
    lastName: "Dupont",
    email: "jean@example.com",
    phone: "06 12 34 56 78",
    company: "Dupont Plomberie",
    metier: "Plombier",
    ville: "Lyon",
    plan: "ESSENTIEL", // ou PRO ou MAX
  }),
});
```

L'endpoint `/api/leads` est public (pas besoin d'auth).

---

## Structure du projet

```
backoffice-iartisan/
├── app/
│   ├── (auth)/login/page.tsx    # Page de connexion
│   ├── admin/page.tsx           # Dashboard admin (KPIs, clients, leads)
│   ├── api/
│   │   ├── auth/login/route.ts  # API login
│   │   ├── auth/logout/route.ts # API logout
│   │   ├── clients/route.ts     # CRUD clients + Stripe
│   │   ├── leads/route.ts       # Leads formulaire public
│   │   ├── stats/route.ts       # KPIs temps réel
│   │   └── webhooks/stripe/route.ts # Webhook Stripe
│   ├── lib/
│   │   ├── auth.ts              # JWT (jose)
│   │   ├── db.ts                # Prisma client
│   │   └── stripe.ts            # Stripe client + plans
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                 # Redirect → /admin
├── prisma/schema.prisma
├── middleware.ts                 # Auth protection
├── tailwind.config.js
├── postcss.config.js
└── package.json
```

---

## API Endpoints

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/api/auth/login` | Non | Connexion admin |
| POST | `/api/auth/logout` | Non | Déconnexion |
| GET | `/api/stats` | Oui | KPIs dashboard |
| GET | `/api/clients` | Oui | Liste clients (filtres, pagination) |
| POST | `/api/clients` | Oui | Créer client + abo Stripe |
| GET | `/api/leads` | Oui | Liste leads |
| POST | `/api/leads` | Non | Nouveau lead (formulaire public) |
| POST | `/api/webhooks/stripe` | Stripe | Webhook Stripe |
