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
        <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 32 }}>Dernière mise à jour : mai 2026</p>

        <div style={{ background: "#fff", borderRadius: 16, padding: "32px 28px", border: "1px solid #e5e7eb", lineHeight: 1.8, fontSize: 15, color: "#374151" }}>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginBottom: 12 }}>1. Éditeur du site</h2>
          <p>
            Le site <strong>iartisan.io</strong> est édité par <strong>iArtisan</strong>, marque commerciale exploitée par une entreprise individuelle relevant du régime de la micro-entreprise, immatriculée au répertoire SIRENE de l&apos;INSEE.
          </p>
          <p style={{ marginTop: 8 }}>
            <strong>Numéro SIRET :</strong> 884 858 234 00021<br />
            <strong>Numéro SIREN :</strong> 884 858 234<br />
            <strong>Adresse du siège :</strong> 270 Rue Pierre Duhem, 13290 Aix-en-Provence, France<br />
            <strong>Code APE :</strong> 63.12Z — Portails Internet<br />
            <strong>Régime fiscal :</strong> micro-entreprise — TVA non applicable, article 293 B du CGI<br />
            <strong>Email de contact :</strong> contact@iartisan.io<br />
            <strong>Directeur de la publication :</strong> M. Faicel Beghdali
          </p>
          <p style={{ marginTop: 8, fontSize: 13, color: "#6b7280" }}>
            Conformément à l&apos;article A123-1-1 du Code de commerce, les coordonnées complètes du dirigeant légal peuvent être obtenues sur demande adressée à contact@iartisan.io.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginTop: 28, marginBottom: 12 }}>2. Hébergement</h2>
          <p>
            Le site est hébergé par <strong>Vercel Inc.</strong>, 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis (vercel.com), certifié EU-US Data Privacy Framework.
          </p>
          <p style={{ marginTop: 8 }}>
            La base de données est hébergée par <strong>Supabase Inc.</strong> sur la région européenne <em>eu-west-3 (Paris, France)</em>. Site web : supabase.com.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginTop: 28, marginBottom: 12 }}>3. Propriété intellectuelle</h2>
          <p>
            L&apos;ensemble du contenu du site iartisan.io (textes, images, logos, icônes, logiciels, base de données) est protégé par le droit de la propriété intellectuelle. Toute reproduction, représentation, modification ou exploitation non autorisée est interdite.
          </p>
          <p style={{ marginTop: 8 }}>
            La marque <strong>iArtisan</strong> et les noms des agents IA (Marie, Lucas, Samir) sont des marques d&apos;usage en cours de dépôt à l&apos;INPI.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginTop: 28, marginBottom: 12 }}>4. Responsabilité</h2>
          <p>
            iArtisan s&apos;efforce d&apos;assurer l&apos;exactitude des informations diffusées sur le site, mais ne saurait être tenue responsable des erreurs, omissions ou résultats obtenus suite à l&apos;utilisation de ces informations. L&apos;accès au site peut être interrompu à tout moment pour maintenance ou mise à jour.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginTop: 28, marginBottom: 12 }}>5. Liens hypertextes</h2>
          <p>
            Le site peut contenir des liens vers des sites tiers. iArtisan n&apos;exerce aucun contrôle sur ces sites et décline toute responsabilité quant à leur contenu.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginTop: 28, marginBottom: 12 }}>6. Droit applicable et juridiction compétente</h2>
          <p>
            Les présentes mentions légales sont régies par le droit français. En cas de litige, et après tentative de recherche d&apos;une solution amiable, les tribunaux français seront seuls compétents — pour les professionnels, le tribunal de commerce d&apos;Aix-en-Provence ; pour les consommateurs, le tribunal du lieu de leur domicile ou celui du lieu d&apos;exécution du service, conformément à l&apos;article R.631-3 du Code de la consommation.
          </p>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", marginTop: 28, marginBottom: 12 }}>7. Médiation de la consommation</h2>
          <p>
            Conformément à l&apos;article L.612-1 du Code de la consommation, le consommateur a la possibilité de recourir gratuitement à un médiateur de la consommation en vue de la résolution amiable d&apos;un litige. Pour iArtisan, le médiateur compétent est <strong>Médiateur de la consommation AME</strong> — site : <a href="https://www.mediationconso-ame.com" style={{ color: "#2563eb" }}>mediationconso-ame.com</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
