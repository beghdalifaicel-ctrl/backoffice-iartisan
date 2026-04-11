"use client";

import { useRouter } from "next/navigation";

export default function NotFound() {
  const router = useRouter();

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        background: "#f8f9fa",
        padding: 24,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 72, fontWeight: 800, color: "#2563eb", marginBottom: 8 }}>
        404
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1a2e", marginBottom: 8 }}>
        Page introuvable
      </h1>
      <p style={{ fontSize: 16, color: "#6b7280", maxWidth: 400, marginBottom: 32, lineHeight: 1.5 }}>
        Cette page n&apos;existe pas ou a été déplacée. Pas de panique, vos agents IA continuent de bosser.
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <button
          onClick={() => router.back()}
          style={{
            padding: "12px 24px",
            borderRadius: 10,
            border: "1px solid #d1d5db",
            background: "white",
            color: "#374151",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          ← Retour
        </button>
        <button
          onClick={() => router.push("/")}
          style={{
            padding: "12px 24px",
            borderRadius: 10,
            border: "none",
            background: "#2563eb",
            color: "white",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Accueil
        </button>
      </div>
    </div>
  );
}
