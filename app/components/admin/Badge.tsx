"use client";

interface BadgeProps {
  label: string;
  bg: string;
  color: string;
  style?: React.CSSProperties;
}

export default function Badge({ label, bg, color, style }: BadgeProps) {
  return (
    <span
      style={{
        padding: "3px 10px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 600,
        background: bg,
        color,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {label}
    </span>
  );
}
