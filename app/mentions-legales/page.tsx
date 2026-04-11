import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mentions légales",
  description: "Mentions légales du site iArtisan.io — éditeur, hébergement, propriété intellectuelle.",
};

export default function MentionsLegales() {
  return (
    <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", background: "#f8f9fa", minHeight: "100vh", color: "#1a1a2e" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 80px" }}>
        <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, color: "#2563eb", textDecoration: "none", marginBottom: 24 }}>
          ← Retour à l&apos;accueil
        </a>

        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Mentions légales</h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 32 }}>Dernière mise à jour : avril 2026</p>

        <div style={{ background: "#fff", borderRadius: 16, padding: "32px 28px", border: "1px solid #e5e7eb", lineHeight: 1.8, fontSize: 15, color: "#374151" }}>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginBottom: 12 }}>1. Éditeur du site</h2>
          <p>
            Le site <strong>iartisan.io</strong> est édité par la société <strong>iArtisan</strong>, société par actions simplifiée (SAS) au capital social de 1 000 euros, immatriculée au Registre du Commerce et des Sociétés de Paris.
          </p>
          <p style={{ marginTop: 8 }}>
            Siège social : Paris, France<br />
            Numéro de téléphone : 01 76 34 02 56<br />
            Adresse email : contact@iartisan.io<br />
            Directeur de la publication : Faicel Beghdali
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginTop: 28, marginBottom: 12 }}>2. Hébergement</h2>
          <p>
            Le site est hébergé par <strong>Vercel Inc.</strong>, 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis. Site web : vercel.com.
          </p>
          <p style={{ marginTop: 8 }}>
            La base de données est hébergée par <strong>Supabase Inc.</strong>, 970 Toa Payoh North #07-04, Singapour. Site web : supabase.com.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginTop: 28, marginBottom: 12 }}>3. Propriété intellectuelle</h2>
          <p>
            L&apos;ensemble du contenu du site iartisan.io (textes, images, logos, icônes, logiciels, base de données) est protégé par le droit de la propriété intellectuelle. Toute reproduction, représentation, modification ou exploitation non autorisée est interdite.
          </p>
          <p style={{ marginTop: 8 }}>
            La marque <strong>iArtisan</strong>, le logo et les noms des agents (Marie, Lucas, Samir) sont des marques déposées ou en cours de dépôt.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginTop: 28, marginBottom: 12 }}>4. Responsabilité</h2>
          <p>
            iArtisan s&apos;efforce d&apos;assurer l&apos;exactitude des informations diffusées sur le site, mais ne saurait être tenue responsable des erreurs, omissions ou résultats obtenus suite à l&apos;utilisation de ces informations. L&apos;accès au site peut être interrompu à tout moment pour maintenance ou mise à jour.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginTop: 28, marginBottom: 12 }}>5. Liens hypertextes</h2>
          <p>
            Le site peut contenir des liens vers des sites tiers. iArtisan n&apos;exerce aucun contrôle sur ces sites et décline toute responsabilité quant à leur contenu.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginTop: 28, marginBottom: 12 }}>6. Droit applicable</h2>
          <p>
            Les présentes mentions légales sont régies par le droit français. Tout litige sera soumis à la compétence exclusive des tribunaux de Paris.
          </p>
        </div>
      </div>
    </div>
  );
}
