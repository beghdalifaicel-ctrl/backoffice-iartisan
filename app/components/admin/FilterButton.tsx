"use client";

import { C } from "@/lib/design-tokens";

interface FilterButtonProps {
  label: string;
  active: boolean;
  activeColor?: string;
  activeBg?: string;
  onClick: () => void;
}

export default function FilterButton({
  label,
  active,
  activeColor = C.accent,
  activeBg = "rgba(255,92,0,.1)",
  onClick,
}: FilterButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 14px",
        borderRadius: 20,
        border: `1px solid ${active ? activeColor : C.border}`,
        background: active ? activeBg : C.surface,
        color: active ? activeColor : C.muted,
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        whiteSpace: "nowrap",
        fontFamily: "inherit",
      }}
    >
      {label}
    </button>
  );
}
