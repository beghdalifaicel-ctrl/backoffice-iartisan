"use client";

import { useState } from "react";

const T = {
  bg: "#f7f4ef",
  dark: "#1a1a14",
  accent: "#ff5c00",
  muted: "#7a7a6a",
  surface: "#ffffff",
  border: "#e5e0d8",
  green: "#2d6a4f",
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/client/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Erreur");
        return;
      }

      setSent(true);
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ width: "100%", maxWidth: 400, background: T.surface, borderRadius: 16, padding: "40px 28px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: `1px solid ${T.border}`, fontFamily: "'Bricolage Grotesque', sans-serif" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: T.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 18 }}>
              iA
            </div>
            <span style={{ fontWeight: 700, fontSize: 22, color: T.dark }}>iArtisan</span>
          </div>
          <p style={{ color: T.muted, fontSize: 14, margin: 0 }}>Réinitialisation du mot de passe</p>
        </div>

        {sent ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: T.dark, marginBottom: 8 }}>
              Demande envoyée
            </h2>
            <p style={{ color: T.muted, fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              Si cette adresse correspond à un compte, un nouveau mot de passe vous sera communiqué très prochainement.
            </p>
            <a
              href="/client/login"
              style={{
                display: "inline-block",
                background: T.accent,
                color: "#fff",
                padding: "12px 28px",
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 15,
                textDecoration: "none",
              }}
            >
              Retour à la connexion
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p style={{ color: T.muted, fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
              Entrez votre adresse email. Un nouveau mot de passe vous sera communiqué.
            </p>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: T.dark, marginBottom: 6 }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                required
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: `1px solid ${T.border}`,
                  fontSize: 16,
                  outline: "none",
                  fontFamily: "'Bricolage Grotesque', sans-serif",
                  background: T.bg,
                  color: T.dark,
                  boxSizing: "border-box",
                }}
              />
            </div>

            {error && (
              <div style={{ background: "#fef2f2", color: "#dc2626", padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 16, textAlign: "center" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 10,
                border: "none",
                background: loading || !email ? T.muted : T.accent,
                color: "#fff",
                fontWeight: 700,
                fontSize: 15,
                cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "'Bricolage Grotesque', sans-serif",
                opacity: loading || !email ? 0.6 : 1,
                minHeight: 48,
              }}
            >
              {loading ? "Envoi..." : "Réinitialiser mon mot de passe"}
            </button>

            <p style={{ textAlign: "center", marginTop: 16, marginBottom: 0 }}>
              <a href="/client/login" style={{ color: T.muted, fontSize: 13, textDecoration: "none" }}>
                ← Retour à la connexion
              </a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
