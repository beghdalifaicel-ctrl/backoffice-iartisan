"use client";

import { C } from "@/lib/design-tokens";
import { ReactNode } from "react";

interface CardProps {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  style?: React.CSSProperties;
}

export default function Card({ active = false, onClick, children, style }: CardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: C.surface,
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
        boxShadow: "0 4px 20px rgba(26,26,20,.06)",
        border: `1px solid ${active ? C.accent : C.border}`,
        cursor: onClick ? "pointer" : "default",
        transition: "border-color .2s",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
