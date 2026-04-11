"use client";

import { useEffect } from "react";

export default function ClientError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Client error:", error);
  }, [error]);

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
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔧</div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1a1a2e", marginBottom: 8 }}>
        Oups, un souci technique
      </h1>
      <p style={{ fontSize: 15, color: "#6b7280", maxWidth: 380, marginBottom: 24, lineHeight: 1.5 }}>
        Pas d&apos;inquiétude, vos devis et factures sont en sécurité. Réessayez ou retournez au tableau de bord.
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <button
          onClick={() => reset()}
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
          Réessayer
        </button>
        <a
          href="/client"
          style={{
            padding: "12px 24px",
            borderRadius: 10,
            border: "1px solid #d1d5db",
            background: "white",
            color: "#374151",
            fontSize: 15,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Tableau de bord
        </a>
      </div>
      <p style={{ fontSize: 13, color: "#9ca3af", marginTop: 24 }}>
        Besoin d&apos;aide ? 01 76 34 02 56
      </p>
    </div>
  );
}
