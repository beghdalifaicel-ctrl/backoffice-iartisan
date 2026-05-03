// /demo — landing démo simple servi sur app.iartisan.io/demo
// Embed l'animation WhatsApp hébergée sur iartisan.io via iframe.
// Aucune auth requise (whitelisté dans middleware.ts).

export const metadata = {
  title: "Démo iArtisan · 90 secondes",
  description: "Voyez en 90 secondes comment iArtisan transforme vos appels manqués en RDV WhatsApp et vos clients en avis Google.",
};

export default function DemoPage() {
  return (
    <main style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #fff 0%, #fff7ed 100%)",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      color: "#1d1d1b",
    }}>
      {/* Header */}
      <header style={{
        padding: "20px 24px",
        borderBottom: "1px solid #f4ede2",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        maxWidth: 1200,
        margin: "0 auto",
      }}>
        <a href="https://iartisan.io" style={{
          fontWeight: 800,
          fontSize: 20,
          color: "#1d1d1b",
          textDecoration: "none",
          letterSpacing: -0.5,
        }}>
          <span style={{ color: "#ff5c00" }}>i</span>Artisan
        </a>
        <a href="https://iartisan.io" style={{
          fontSize: 14,
          color: "#6a6a5a",
          textDecoration: "none",
        }}>
          ← Retour au site
        </a>
      </header>

      <section style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "48px 24px 80px",
      }}>
        {/* Titre */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            fontSize: 11,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: "#ff5c00",
            fontWeight: 800,
            marginBottom: 12,
          }}>
            Démo · 90 secondes
          </div>
          <h1 style={{
            fontSize: "clamp(28px, 5vw, 44px)",
            lineHeight: 1.1,
            margin: "0 0 16px",
            fontWeight: 800,
            letterSpacing: -1,
          }}>
            Voyez Marie répondre à un client à votre place
          </h1>
          <p style={{
            fontSize: 17,
            color: "#6a6a5a",
            maxWidth: 640,
            margin: "0 auto",
            lineHeight: 1.5,
          }}>
            Un client envoie un message WhatsApp — Marie qualifie, prend RDV, vous prévient. Sans que vous décrochiez.
          </p>
        </div>

        {/* Iframe demo */}
        <div style={{
          maxWidth: 380,
          margin: "0 auto 40px",
          borderRadius: 28,
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)",
          border: "1px solid #e7e7e2",
          background: "#000",
          aspectRatio: "9 / 19.5",
        }}>
          <iframe
            src="https://iartisan.io/demo-whatsapp-v4-fixed.html"
            title="Démo WhatsApp iArtisan"
            allow="autoplay"
            style={{
              width: "100%",
              height: "100%",
              border: 0,
              display: "block",
            }}
          />
        </div>

        {/* CTAs */}
        <div style={{
          display: "flex",
          gap: 12,
          justifyContent: "center",
          flexWrap: "wrap",
          marginBottom: 24,
        }}>
          <a href="/client/signup" style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#ff5c00",
            color: "#fff",
            padding: "14px 28px",
            borderRadius: 999,
            fontWeight: 700,
            fontSize: 15,
            textDecoration: "none",
            boxShadow: "0 4px 14px rgba(255,92,0,0.35)",
          }}>
            Commencer mon essai gratuit 14 j
          </a>
          <a href="https://iartisan.io#callback" style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#fff",
            color: "#1d1d1b",
            padding: "14px 28px",
            borderRadius: 999,
            fontWeight: 700,
            fontSize: 15,
            textDecoration: "none",
            border: "1.5px solid #1d1d1b",
          }}>
            Être rappelé
          </a>
        </div>

        {/* Reassurance */}
        <div style={{
          textAlign: "center",
          fontSize: 13,
          color: "#6a6a5a",
        }}>
          Sans CB · Annulation en 1 clic · 49 € / mois après l'essai
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: "1px solid #f4ede2",
        padding: "24px",
        textAlign: "center",
        fontSize: 12,
        color: "#8a8a7a",
      }}>
        iArtisan — Linda BEGHDALI · SIRET 884 858 234 00021 · 270 Rue Pierre Duhem, 13290 Aix-en-Provence ·{" "}
        <a href="https://iartisan.io/mentions-legales" style={{ color: "#8a8a7a" }}>Mentions légales</a> ·{" "}
        <a href="https://iartisan.io/cgv" style={{ color: "#8a8a7a" }}>CGV</a>
      </footer>
    </main>
  );
}
