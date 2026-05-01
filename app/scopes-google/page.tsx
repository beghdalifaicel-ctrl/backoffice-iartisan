import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accès à votre fiche Google Business Profile — iArtisan",
  description:
    "Comment et pourquoi iArtisan demande l'accès à votre fiche Google Business Profile pour automatiser la publication de posts et la gestion des avis.",
};

export default function ScopesGoogle() {
  return (
    <div
      style={{
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        background: "#f8f9fa",
        minHeight: "100vh",
        color: "#1a1a2e",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 80px" }}>
        <a
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 14,
            color: "#2563eb",
            textDecoration: "none",
            marginBottom: 24,
          }}
        >
          ← Retour à l&apos;accueil
        </a>

        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
          Accès à votre fiche Google Business Profile
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 32 }}>
          Dernière mise à jour : mai 2026
        </p>

        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: "32px 28px",
            border: "1px solid #e5e7eb",
            lineHeight: 1.8,
            fontSize: 15,
            color: "#374151",
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginBottom: 12 }}>
            1. À quoi sert cet accès ?
          </h2>
          <p>
            iArtisan propose à ses clients artisans de déléguer la gestion de leur présence en ligne à un agent IA
            (Lucas). Pour automatiser la publication d&apos;actualités sur votre fiche Google Business Profile et la
            réponse aux avis clients, nous avons besoin que vous nous accordiez l&apos;accès à votre fiche via le
            protocole standard <strong>Google OAuth 2.0</strong>.
          </p>
          <p style={{ marginTop: 8 }}>
            Cet accès est <strong>optionnel</strong> et n&apos;est jamais activé par défaut : vous devez l&apos;autoriser
            explicitement depuis votre tableau de bord iArtisan, et vous pouvez le révoquer à tout moment.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginTop: 28, marginBottom: 12 }}>
            2. Quel niveau d&apos;accès est demandé ?
          </h2>
          <p>
            Nous demandons <strong>un seul niveau d&apos;accès Google</strong> : <code>business.manage</code> (gestion
            de votre fiche d&apos;établissement). Ce niveau d&apos;accès permet à iArtisan, en votre nom, de :
          </p>
          <p style={{ marginTop: 8 }}>
            <strong>Lire</strong> les informations publiques de votre fiche (adresse, horaires, photos, avis reçus,
            posts publiés).
            <br />
            <strong>Publier</strong> des posts (actualités chantier, dépannage, avant/après) sur votre fiche, après
            génération par notre agent IA et — pour les 3 premiers posts — validation manuelle par vous.
            <br />
            <strong>Répondre</strong> aux avis laissés par vos clients, après génération par notre agent IA et
            validation manuelle systématique pour les 3 premières réponses.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginTop: 28, marginBottom: 12 }}>
            3. Ce que nous ne faisons PAS
          </h2>
          <p>
            <strong>Nous ne supprimons jamais</strong> de posts, d&apos;avis, de photos ou d&apos;informations
            existantes sur votre fiche.
            <br />
            <strong>Nous ne modifions jamais</strong> vos informations d&apos;identification (nom, adresse, horaires)
            sans demande explicite de votre part.
            <br />
            <strong>Nous ne lisons aucun autre service Google</strong> (Gmail, Drive, Calendar…). L&apos;accès est
            strictement limité à votre fiche d&apos;établissement.
            <br />
            <strong>Nous ne partageons pas</strong> ces données avec des tiers à des fins commerciales ou
            publicitaires.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginTop: 28, marginBottom: 12 }}>
            4. Comment vos données sont-elles stockées ?
          </h2>
          <p>
            Lorsque vous autorisez l&apos;accès, Google nous transmet un <em>refresh token</em> qui nous permet de
            renouveler l&apos;accès à votre fiche sans vous redemander votre mot de passe à chaque action. Ce refresh
            token est immédiatement <strong>chiffré (AES-256)</strong> avant d&apos;être stocké dans notre base de
            données européenne (Supabase, région Paris). La clé de chiffrement est elle-même protégée par un
            coffre-fort dédié (Supabase Vault).
          </p>
          <p style={{ marginTop: 8 }}>
            Aucun jeton d&apos;accès actif (<em>access token</em>) n&apos;est jamais conservé : ils sont régénérés à
            la demande, valides 1 heure, et n&apos;existent qu&apos;en mémoire le temps de chaque action.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginTop: 28, marginBottom: 12 }}>
            5. Comment révoquer l&apos;accès ?
          </h2>
          <p>
            Vous pouvez révoquer l&apos;accès iArtisan à tout moment, par 2 moyens :
          </p>
          <p style={{ marginTop: 8 }}>
            <strong>Depuis votre tableau de bord iArtisan</strong> — bouton « Déconnecter Google » dans la section
            Marketing Automation. La révocation est effective immédiatement et le refresh token est supprimé de notre
            base.
            <br />
            <strong>Depuis votre compte Google</strong> — rendez-vous sur{" "}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#2563eb" }}
            >
              myaccount.google.com/permissions
            </a>
            , cherchez « iArtisan », cliquez sur « Supprimer l&apos;accès ».
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginTop: 28, marginBottom: 12 }}>
            6. Validation humaine obligatoire
          </h2>
          <p>
            Pour limiter le risque d&apos;erreur de l&apos;IA (ville inventée, ton inadapté, information factuellement
            fausse), <strong>les 3 premiers posts et les 3 premières réponses aux avis</strong> générés par Lucas pour
            votre fiche font l&apos;objet d&apos;une validation manuelle obligatoire de votre part avant publication.
            Au-delà, vous pouvez choisir de basculer en mode publication automatique ou conserver la validation manuelle
            indéfiniment.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginTop: 28, marginBottom: 12 }}>
            7. Politique générale et contact
          </h2>
          <p>
            Cette page complète notre{" "}
            <a href="/confidentialite" style={{ color: "#2563eb" }}>
              Politique de confidentialité
            </a>{" "}
            et nos{" "}
            <a href="/cgv" style={{ color: "#2563eb" }}>
              Conditions générales de vente
            </a>
            .
          </p>
          <p style={{ marginTop: 8 }}>
            Pour toute question relative à l&apos;intégration Google Business Profile : contact@iartisan.io.
          </p>
        </div>
      </div>
    </div>
  );
}
