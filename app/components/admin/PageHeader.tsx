"use client";

import { C } from "@/lib/design-tokens";
import { ArrowLeft } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle: string;
  backHref?: string;
}

export default function PageHeader({ title, subtitle, backHref = "/admin" }: PageHeaderProps) {
  return (
    <div style={{ padding: "16px 16px 0", display: "flex", alignItems: "center", gap: 12 }}>
      <a
        href={backHref}
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: C.surface,
          border: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textDecoration: "none",
        }}
      >
        <ArrowLeft size={18} color={C.dark} />
      </a>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px" }}>{title}</div>
        <div style={{ fontSize: 12, color: C.muted }}>{subtitle}</div>
      </div>
    </div>
  );
}
