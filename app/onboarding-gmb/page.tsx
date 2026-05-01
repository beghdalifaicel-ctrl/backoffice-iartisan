import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getGmbConnectionInfo } from "@/lib/integrations/gmb";

export const metadata: Metadata = {
  title: "Connecter Google Business — iArtisan",
  description: "Reliez votre fiche Google Business Profile à iArtisan pour automatiser la publication de posts et la gestion des avis.",
};

export const dynamic = "force-dynamic";

// Page temporaire pour le pilote J14 GMB — sera remplacée par une section dédiée
// du /dashboard en Phase 2 (J24).

const C = {
  bg: "#f7f4ef",
  dark: "#1a1a14",
  accent: "#ff5c00",
  green: "#2d6a4f",
  muted: "#7a7a6a",
  surface: "#fff",
  border: "#e5e0d8",
  red: "#dc2626",
  blue: "#2563eb",
};

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Vous avez annulé la connexion à Google. Vous pouvez réessayer quand vous le souhaitez.",
  missing_params: "Réponse incomplète de Google. Merci de réessayer.",
  bad_state_format: "Lien d'autorisation invalide. Merci de relancer la connexion depuis cette page.",
  bad_state_sig: "Lien d'autorisation falsifié ou expiré. Merci de relancer la connexion.",
  state_expired: "Le lien d'autorisation a expiré (10 min). Merci de relancer la connexion.",
  state_decode_error: "Lien d'autorisation corrompu. Merci de relancer la connexion.",
  no_refresh_token_returned:
    "Google n'a pas pu fournir d'accès durable. Merci de révoquer iArtisan dans votre compte Google puis de réessayer.",
  no_access_token_returned: "Google n'a pas retourné de jeton d'accès. Merci de réessayer.",
  no_gmb_account_found:
    "Aucune fiche Google Business Profile n'a été trouvée sur votre compte Google. Vérifiez que vous êtes bien propriétaire d'une fiche.",
  no_gmb_location_found:
    "Aucune adresse n'a été trouvée sur votre fiche Google Business Profile. Vérifiez la configuration de votre fiche.",
  encryption_failed: "Erreur technique lors du chiffrement du jeton. Notre équipe a été notifiée.",
};

function readableError(code: string): string {
  return ERROR_MESSAGES[code] || `Erreur Google : ${code}. Merci de réessayer ou de contacter le support.`;
}

interface PageProps {
  searchParams?: { gmb?: string; message?: string };
}

export default async function OnboardingGmbPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session || !session.clientId) {
    redirect("/client/login?next=/onboarding-gmb");
  }

  const info = await getGmbConnectionInfo(session.clientId);
  const status = searchParams?.gmb;
  const errorCode = searchParams?.message;

  return (
    <div
      style={{
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        background: C.bg,
        minHeight: "100vh",
        color: C.dark,
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 80px" }}>
        <a
          href="/client"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 14,
            color: C.blue,
            textDecoration: "none",
            marginBottom: 24,
          }}
        >
          ← Retour à mon espace
        </a>

        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Connecter Google Business Profile</h1>
        <p style={{ fontSize: 15, color: C.muted, marginBottom: 32 }}>
          Permettez à iArtisan de publier des actualités et répondre à vos avis sur votre fiche Google.
        </p>

        {/* ─── Bandeau de retour OAuth ─── */}
        {status === "connected" && (
          <div
            style={{
              background: "#ecfdf5",
              border: `1px solid ${C.green}`,
              borderRadius: 12,
              padding: "14px 16px",
              marginBottom: 24,
              color: "#065f46",
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            ✅ <strong>Fiche Google connectée avec succès.</strong> Lucas peut désormais publier des posts en votre nom
            (avec validation manuelle pour les 3 premiers).
          </div>
        )}
        {status === "error" && errorCode && (
          <div
            style={{
              background: "#fef2f2",
              border: `1px solid ${C.red}`,
              borderRadius: 12,
              padding: "14px 16px",
              marginBottom: 24,
              color: "#991b1b",
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            ⚠️ <strong>Connexion impossible.</strong> {readableError(errorCode)}
          </div>
        )}

        {/* ─── Carte État de connexion ─── */}
        <div
          style={{
            background: C.surface,
            borderRadius: 16,
            padding: "24px 24px",
            border: `1px solid ${C.border}`,
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 4 }}>État</div>
              {info.connected ? (
                <div style={{ fontSize: 18, fontWeight: 700, color: C.green }}>
                  ● Connecté à votre fiche Google
                </div>
              ) : (
                <div style={{ fontSize: 18, fontWeight: 700, color: C.muted }}>
                  ○ Pas encore connecté
                </div>
              )}
              {info.connected && info.gmb_location_name && (
                <div style={{ fontSize: 13, color: C.muted, marginTop: 8 }}>
                  Fiche : <code style={{ background: "#f3f4f6", padding: "2px 6px", borderRadius: 4 }}>{info.gmb_location_name}</code>
                </div>
              )}
              {info.connected && info.connected_at && (
                <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
                  Connectée le {new Date(info.connected_at).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })}
                </div>
              )}
            </div>

            {info.connected ? (
              <form action="/api/oauth/gmb/disconnect" method="POST" style={{ margin: 0 }}>
                <button
                  type="submit"
                  style={{
                    background: "#fff",
                    border: `1px solid ${C.red}`,
                    color: C.red,
                    padding: "10px 18px",
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Déconnecter
                </button>
              </form>
            ) : (
              <a
                href="/api/oauth/gmb/start"
                style={{
                  background: C.dark,
                  color: "#fff",
                  padding: "12px 22px",
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 700,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <GoogleGlyph /> Connecter ma fiche Google
              </a>
            )}
          </div>
        </div>

        {/* ─── Carte explicative ─── */}
        <div
          style={{
            background: C.surface,
            borderRadius: 16,
            padding: "24px 24px",
            border: `1px solid ${C.border}`,
            lineHeight: 1.7,
            fontSize: 14,
            color: "#374151",
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700, color: C.dark, marginBottom: 12 }}>
            Ce que cette connexion autorise
          </h2>
          <p>
            iArtisan demandera <strong>un seul niveau d&apos;accès</strong> Google :{" "}
            <code style={{ background: "#f3f4f6", padding: "2px 6px", borderRadius: 4 }}>business.manage</code>. Aucun
            autre service Google (Gmail, Drive, Calendar) n&apos;est touché.
          </p>
          <p style={{ marginTop: 12 }}>
            <strong>✓ Lecture</strong> de votre fiche (adresse, horaires, avis).
            <br />
            <strong>✓ Publication</strong> de posts (chantiers terminés, dépannage, avant/après) — validation manuelle
            pour les 3 premiers.
            <br />
            <strong>✓ Réponses</strong> aux avis clients — validation manuelle pour les 3 premières.
          </p>
          <p style={{ marginTop: 12 }}>
            <strong>✗ Aucune suppression</strong> de posts ou d&apos;avis existants.
            <br />
            <strong>✗ Aucune modification</strong> de vos infos d&apos;identification (nom, adresse).
            <br />
            <strong>✗ Aucun partage</strong> de vos données avec des tiers.
          </p>

          <p style={{ marginTop: 16, fontSize: 13, color: C.muted }}>
            Vous pouvez révoquer cet accès à tout moment depuis cette page ou directement depuis votre compte Google.
            En savoir plus :{" "}
            <a href="/scopes-google" style={{ color: C.blue }}>
              détail des accès Google demandés
            </a>{" "}
            • <a href="/confidentialite" style={{ color: C.blue }}>politique de confidentialité</a>.
          </p>
        </div>
      </div>
    </div>
  );
}

// Tiny inline SVG glyph for the "G" — avoids pulling lucide-react into a server component
function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#fff"
        d="M21.6 12.227c0-.682-.061-1.337-.175-1.966H12v3.72h5.385c-.232 1.252-.937 2.313-1.997 3.022v2.51h3.232c1.892-1.742 2.98-4.305 2.98-7.286z"
      />
      <path
        fill="#fff"
        d="M12 22c2.7 0 4.964-.895 6.62-2.426l-3.232-2.51c-.895.6-2.04.954-3.388.954-2.605 0-4.81-1.76-5.598-4.124H3.062v2.59C4.71 19.755 8.097 22 12 22z"
      />
      <path
        fill="#fff"
        d="M6.402 13.894A6.002 6.002 0 0 1 6.082 12c0-.66.114-1.302.32-1.894V7.516H3.062A9.996 9.996 0 0 0 2 12c0 1.614.387 3.142 1.062 4.484l3.34-2.59z"
      />
      <path
        fill="#fff"
        d="M12 5.98c1.47 0 2.79.505 3.83 1.498l2.87-2.87C16.96 2.99 14.696 2 12 2 8.097 2 4.71 4.245 3.062 7.516l3.34 2.59C7.19 7.74 9.396 5.98 12 5.98z"
      />
    </svg>
  );
}
