"use client";

import { LucideIcon } from "lucide-react";

interface ActionButtonProps {
  href: string;
  icon: LucideIcon;
  label: string;
  color: string;
  bg: string;
  onClick?: (e: React.MouseEvent) => void;
}

export default function ActionButton({ href, icon: Icon, label, color, bg, onClick }: ActionButtonProps) {
  return (
    <a
      href={href}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      style={{
        flex: 1,
        padding: "10px 0",
        borderRadius: 10,
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        textDecoration: "none",
        color,
        fontWeight: 600,
        fontSize: 13,
      }}
    >
      <Icon size={14} /> {label}
    </a>
  );
}
