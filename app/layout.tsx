import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "iArtisan — Assistants IA pour artisans du BTP",
  description: "Vos agents IA gèrent emails, devis, factures, Google Business, prospection et relances. 14 jours d'essai gratuit.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
