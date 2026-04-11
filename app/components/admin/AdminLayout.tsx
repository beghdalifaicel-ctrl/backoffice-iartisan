"use client";

import { C, FONT, FONT_URL } from "@/lib/design-tokens";
import { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: FONT,
        background: C.bg,
        minHeight: "100vh",
        color: C.dark,
        fontSize: 14,
        maxWidth: 600,
        margin: "0 auto",
      }}
    >
      <link href={FONT_URL} rel="stylesheet" />
      {children}
    </div>
  );
}
