"use client";

import { C } from "@/lib/design-tokens";

interface KPICardProps {
  label: string;
  value: string | number;
  color?: string;
  /** "compact" for small grid KPIs, "full" for larger revenue cards */
  variant?: "compact" | "full";
}

export default function KPICard({ label, value, color = C.dark, variant = "compact" }: KPICardProps) {
  if (variant === "full") {
    return (
      <div style={{ background: C.surface, borderRadius: 14, padding: 14, border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {label}
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
      </div>
    );
  }

  return (
    <div style={{ background: C.surface, borderRadius: 12, padding: "8px 10px", border: `1px solid ${C.border}`, textAlign: "center" }}>
      <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 10, color: C.muted, fontWeight: 600 }}>{label}</div>
    </div>
  );
}
