import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions Générales de Vente",
  description: "CGV du service iArtisan — abonnement, essai gratuit, facturation, résiliation et responsabilités.",
};

export default function CGV() {
  return (
    <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", background: "#f8f9fa", minHeight: "100vh", color: "#1a1a2e" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 80px" }}>
        <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, color: "#2563eb", textDecoration: "none", marginBottom: 24 }}>
          ← Retour à l&apos;accueil
        </a>

        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Conditions Générales de Vente</h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 32 }}>Dernière mise à jour : avril 2026</p>

        <div style={{ background: "#fff", borderRadius: 16, padding: "32px 28px", border: "1px solid #e5e7eb", lineHeight: 1.8, fontSize: 15, color: "#374151" }}>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginBottom: 12 }}>1. Objet</h2>
          <p>
            Les présentes Conditions Générales de Vente (CGV) régissent l&apos;accès et l&apos;utilisation du service iArtisan, plateforme d&apos;assistants IA destinée aux artisans du BTP. Toute souscription implique l&apos;acceptation sans réserve des présentes CGV.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginTop: 28, marginBottom: 12 }}>2. Description du service</h2>
          <p>
            iArtisan fournit des agents d&apos;intelligence artificielle qui assistent les artisans du BTP dans la gestion de leurs appels, devis, factures, prospection commerciale, suivi client et présence en ligne (Google Business). Le service est accessible via l&apos;application web app.iartisan.io.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginTop: 28, marginBottom: 12 }}>3. Offres et tarifs</h2>
          <p>
            iArtisan propose trois formules d&apos;abonnement mensuel :
          </p>
          <p style={{ marginTop: 8 }}>
            <strong>Essentiel</strong> — 49 € HT/mois : 1 agent IA (secrétaire virtuelle), gestion des appels et messages, devis et factures.<br />
            <strong>Pro</strong> — 99 € HT/mois : 2 agents IA (secrétaire + commercial digital), prospection automatisée, Google Business.<br />
            <strong>Max</strong> — 179 € HT/mois : 3 agents IA (secrétaire + commercial + apporteur d&apos;affaires), toutes les fonctionnalités, priorité support.
          </p>
          <p style={{ marginTop: 8 }}>
            Les prix sont indiqués hors taxes. La TVA applicable sera ajoutée au moment de la facturation conformément à la réglementation en vigueur.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginTop: 28, marginBottom: 12 }}>4. Période d&apos;essai</h2>
          <p>
            Chaque nouvel abonné bénéficie d&apos;une période d&apos;essai gratuite de 14 jours calendaires à compter de la date d&apos;inscription. Pendant cette période, l&apos;utilisateur a accès à l&apos;intégralité des fonctionnalités de l&apos;offre choisie. Aucun prélèvement n&apos;est effectué pendant la période d&apos;essai. À l&apos;issue de cette période, l&apos;abonnement sera automatiquement activé sauf résiliation préalable.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginTop: 28, marginBottom: 12 }}>5. Paiement et facturation</h2>
          <p>
            Le paiement s&apos;effectue par carte bancaire via la plateforme sécurisée Stripe. La facturation est mensuelle, prélevée automatiquement à la date anniversaire de l&apos;abonnement. En cas d&apos;échec de paiement, le compte sera suspendu après 7 jours de délai de grâce.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginTop: 28, marginBottom: 12 }}>6. Résiliation</h2>
          <p>
            L&apos;abonnement peut être résilié à tout moment depuis l&apos;espace client ou en contactant le support. La résiliation prend effet à la fin de la période de facturation en cours. Aucun remboursement au prorata ne sera effectué pour la période restante. L&apos;accès aux données reste possible pendant 30 jours après la résiliation, passé ce délai les données seront supprimées.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginTop: 28, marginBottom: 12 }}>7. Obligations de l&apos;utilisateur</h2>
          <p>
            L&apos;utilisateur s&apos;engage à fournir des informations exactes lors de l&apos;inscription, à ne pas utiliser le service à des fins illicites, à ne pas tenter de contourner les mesures de sécurité, et à maintenir la confidentialité de ses identifiants de connexion.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginTop: 28, marginBottom: 12 }}>8. Responsabilité</h2>
          <p>
            iArtisan s&apos;engage à fournir un service conforme à sa description. Les agents IA sont des outils d&apos;assistance et ne se substituent pas au jugement professionnel de l&apos;artisan. iArtisan ne saurait être tenue responsable des décisions prises sur la base des suggestions générées par les agents IA. La responsabilité d&apos;iArtisan est limitée au montant des sommes versées par le client au cours des 12 derniers mois.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginTop: 28, marginBottom: 12 }}>9. Disponibilité du service</h2>
          <p>
            iArtisan s&apos;engage à un taux de disponibilité de 99,5 % sur une base mensuelle, hors maintenances programmées. Les maintenances seront notifiées 48 heures à l&apos;avance sauf urgence.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginTop: 28, marginBottom: 12 }}>10. Droit de rétractation</h2>
          <p>
            Conformément à l&apos;article L.221-28 du Code de la consommation, le droit de rétractation ne s&apos;applique pas aux contrats de fourniture de contenu numérique fourni sur un support immatériel dont l&apos;exécution a commencé. La période d&apos;essai gratuite de 14 jours permet néanmoins de tester le service sans engagement.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginTop: 28, marginBottom: 12 }}>11. Litiges</h2>
          <p>
            Les présentes CGV sont soumises au droit français. En cas de litige, les parties s&apos;efforceront de trouver une solution amiable. À défaut, les tribunaux de Paris seront seuls compétents. Conformément au droit en vigueur, le client peut recourir à un médiateur de la consommation.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginTop: 28, marginBottom: 12 }}>12. Contact</h2>
          <p>
            Pour toute question relative aux présentes CGV : contact@iartisan.io ou 01 76 34 02 56.
          </p>
        </div>
      </div>
    </div>
  );
}
