"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const T = {
  bg: "#f7f4ef",
  dark: "#1a1a14",
  accent: "#ff5c00",
  green: "#2d6a4f",
  muted: "#7a7a6a",
  surface: "#ffffff",
  border: "#e5e0d8",
};

export default function ClientLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/client/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erreur de connexion");
        return;
      }

      router.push(data.redirectTo || "/client");
      router.refresh();
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ width: "100%", maxWidth: 400, background: T.surface, borderRadius: 16, padding: "40px 28px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: `1px solid ${T.border}` }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: T.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 18 }}>
              iA
            </div>
            <span style={{ fontWeight: 700, fontSize: 22, color: T.dark, fontFamily: "'Bricolage Grotesque', sans-serif" }}>
              iArtisan
            </span>
          </div>
          <p style={{ color: T.muted, fontSize: 14, margin: 0 }}>Espace client</p>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: T.dark, marginBottom: 6 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com"
              required
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1px solid ${T.border}`, fontSize: 15, outline: "none", fontFamily: "'Bricolage Grotesque', sans-serif", background: T.bg, color: T.dark, boxSizing: "border-box" }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: T.dark, marginBottom: 6 }}>Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              required
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1px solid ${T.border}`, fontSize: 15, outline: "none", fontFamily: "'Bricolage Grotesque', sans-serif", background: T.bg, color: T.dark, boxSizing: "border-box" }}
            />
          </div>

          {error && (
            <div style={{ background: "#fef2f2", color: "#dc2626", padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 16, textAlign: "center" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ width: "100%", padding: 14, borderRadius: 10, border: "none", background: loading ? T.muted : T.accent, color: "#fff", fontWeight: 700, fontSize: 15, cursor: loading ? "not-allowed" : "pointer", fontFamily: "'Bricolage Grotesque', sans-serif", transition: "background 0.2s" }}
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 16, marginBottom: 0 }}>
          <a href="/client/forgot-password" style={{ color: T.muted, fontSize: 13, textDecoration: "none" }}>
            Mot de passe oublié ?
          </a>
        </p>

        <p style={{ textAlign: "center", marginTop: 12, marginBottom: 0 }}>
          <a href="/client/signup" style={{ color: T.accent, fontSize: 13, fontWeight: 600, textDecoration: "none", fontFamily: "'Bricolage Grotesque', sans-serif" }}>
            Pas encore de compte ? S'inscrire
          </a>
        </p>

        <p style={{ textAlign: "center", color: T.muted, fontSize: 12, marginTop: 16, marginBottom: 0 }}>
          Espace r&eacute;serv&eacute; aux clients iArtisan.io
        </p>
      </div>
    </div>
  );
}
