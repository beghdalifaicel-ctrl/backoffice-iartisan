"use client";

import { C } from "@/lib/design-tokens";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  pages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, pages, onPageChange }: PaginationProps) {
  if (pages <= 1) return null;

  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    width: 36,
    height: 36,
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    background: C.surface,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.4 : 1,
  });

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 12 }}>
      <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1} style={btnStyle(page === 1)}>
        <ChevronLeft size={16} />
      </button>
      <span style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>{page} / {pages}</span>
      <button onClick={() => onPageChange(Math.min(pages, page + 1))} disabled={page === pages} style={btnStyle(page === pages)}>
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
