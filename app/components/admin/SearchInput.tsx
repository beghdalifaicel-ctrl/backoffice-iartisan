"use client";

import { C } from "@/lib/design-tokens";
import { Search } from "lucide-react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function SearchInput({ value, onChange, placeholder = "Rechercher…" }: SearchInputProps) {
  return (
    <div style={{ padding: "12px 16px" }}>
      <div style={{ position: "relative" }}>
        <Search size={16} color={C.muted} style={{ position: "absolute", left: 12, top: 12 }} />
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 12px 10px 36px",
            borderRadius: 12,
            border: `1px solid ${C.border}`,
            background: C.surface,
            fontSize: 14,
            outline: "none",
            boxSizing: "border-box",
            fontFamily: "inherit",
          }}
        />
      </div>
    </div>
  );
}
