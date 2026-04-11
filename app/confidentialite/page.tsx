import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Politique de confidentialité iArtisan — collecte, traitement et protection de vos données personnelles.",
};

export default function Confidentialite() {
  return (
    <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", background: "#f8f9fa", minHeight: "100vh", color: "#1a1a2e" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 80px" }}>
        <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, color: "#2563eb", textDecoration: "none", marginBottom: 24 }}>
          ← Retour à l&apos;accueil
        </a>

        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Politique de confidentialité</h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 32 }}>Dernière mise à jour : avril 2026</p>

        <div style={{ background: "#fff", borderRadius: 16, padding: "32px 28px", border: "1px solid #e5e7eb", lineHeight: 1.8, fontSize: 15, color: "#374151" }}>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginBottom: 12 }}>1. Responsable du traitement</h2>
          <p>
            Le responsable du traitement des données personnelles est la société <strong>iArtisan SAS</strong>, représentée par Faicel Beghdali, joignable à l&apos;adresse contact@iartisan.io.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginTop: 28, marginBottom: 12 }}>2. Données collectées</h2>
          <p>
            Nous collectons les données suivantes dans le cadre de l&apos;utilisation du service :
          </p>
          <p style={{ marginTop: 8 }}>
            <strong>Données d&apos;identification :</strong> nom, prénom, adresse email, numéro de téléphone, nom de l&apos;entreprise, SIRET, adresse, ville, code postal, métier.<br />
            <strong>Données de facturation :</strong> informations de carte bancaire (traitées exclusivement par Stripe, jamais stockées sur nos serveurs).<br />
            <strong>Données d&apos;utilisation :</strong> historique des devis et factures, interactions avec les agents IA, logs de connexion.<br />
            <strong>Données techniques :</strong> adresse IP, type de navigateur, système d&apos;exploitation, pages visitées.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginTop: 28, marginBottom: 12 }}>3. Finalités du traitement</h2>
          <p>
            Vos données sont traitées pour : la fourniture et l&apos;amélioration du service, la gestion de votre compte et de votre abonnement, la facturation et le paiement, l&apos;envoi de communications liées au service (notifications, alertes), le support client, et la conformité aux obligations légales.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginTop: 28, marginBottom: 12 }}>4. Base légale</h2>
          <p>
            Le traitement de vos données repose sur l&apos;exécution du contrat d&apos;abonnement (article 6.1.b du RGPD) et notre intérêt légitime à améliorer le service (article 6.1.f du RGPD). Pour les communications marketing optionnelles, votre consentement sera recueilli préalablement.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginTop: 28, marginBottom: 12 }}>5. Destinataires des données</h2>
          <p>
            Vos données peuvent être partagées avec les sous-traitants suivants, strictement dans le cadre de la fourniture du service :
          </p>
          <p style={{ marginTop: 8 }}>
            <strong>Stripe</strong> (paiement) — États-Unis, certifié EU-US Data Privacy Framework.<br />
            <strong>Supabase</strong> (hébergement base de données) — Singapour / UE.<br />
            <strong>Vercel</strong> (hébergement application) — États-Unis, certifié EU-US Data Privacy Framework.<br />
            <strong>Resend</strong> (envoi d&apos;emails) — États-Unis.<br />
            <strong>OpenAI / Anthropic</strong> (traitement IA) — États-Unis. Les données transmises aux modèles IA sont anonymisées dans la mesure du possible.
          </p>
          <p style={{ marginTop: 8 }}>
            Aucune donnée n&apos;est vendue à des tiers à des fins commerciales ou publicitaires.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginTop: 28, marginBottom: 12 }}>6. Durée de conservation</h2>
          <p>
            Les données de compte sont conservées pendant toute la durée de l&apos;abonnement et 30 jours après résiliation. Les données de facturation sont conservées 10 ans conformément aux obligations comptables françaises. Les logs techniques sont conservés 12 mois.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginTop: 28, marginBottom: 12 }}>7. Vos droits</h2>
          <p>
            Conformément au RGPD, vous disposez des droits suivants : droit d&apos;accès, droit de rectification, droit à l&apos;effacement, droit à la limitation du traitement, droit à la portabilité des données, droit d&apos;opposition. Pour exercer ces droits, contactez-nous à contact@iartisan.io. Nous nous engageons à répondre dans un délai de 30 jours.
          </p>
          <p style={{ marginTop: 8 }}>
            Vous pouvez également introduire une réclamation auprès de la CNIL (Commission Nationale de l&apos;Informatique et des Libertés) : cnil.fr.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginTop: 28, marginBottom: 12 }}>8. Cookies</h2>
          <p>
            Le site utilise des cookies strictement nécessaires au fonctionnement du service (authentification, préférences). Des cookies d&apos;analyse (Google Analytics) peuvent être utilisés pour mesurer l&apos;audience du site, sous réserve de votre consentement. Vous pouvez configurer votre navigateur pour refuser les cookies.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginTop: 28, marginBottom: 12 }}>9. Sécurité</h2>
          <p>
            Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données : chiffrement des données en transit (TLS) et au repos, authentification par JWT, accès restreint aux bases de données, sauvegardes régulières, monitoring des accès.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginTop: 28, marginBottom: 12 }}>10. Modifications</h2>
          <p>
            Cette politique peut être modifiée à tout moment. Les utilisateurs seront informés par email de tout changement substantiel. La version en vigueur est toujours accessible sur cette page.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginTop: 28, marginBottom: 12 }}>11. Contact</h2>
          <p>
            Pour toute question relative à la protection de vos données : contact@iartisan.io.
          </p>
        </div>
      </div>
    </div>
  );
}
