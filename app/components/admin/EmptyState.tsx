"use client";

import { C } from "@/lib/design-tokens";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  message: string;
}

export default function EmptyState({ icon: Icon, title, message }: EmptyStateProps) {
  return (
    <div style={{ background: C.surface, borderRadius: 16, padding: "32px 20px", border: `1px solid ${C.border}`, textAlign: "center" }}>
      <Icon size={32} color={C.muted} style={{ margin: "0 auto 12px", display: "block" }} />
      <p style={{ fontSize: 14, fontWeight: 700 }}>{title}</p>
      <p style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{message}</p>
    </div>
  );
}
