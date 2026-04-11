"use client";

import { C } from "@/lib/design-tokens";

interface TableRowProps {
  label: string;
  value: string | number;
  color?: string;
  isLast?: boolean;
}

export default function TableRow({ label, value, color = C.dark, isLast = false }: TableRowProps) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: isLast ? "none" : `1px solid ${C.border}` }}>
      <span style={{ fontSize: 13, color: C.muted }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}
