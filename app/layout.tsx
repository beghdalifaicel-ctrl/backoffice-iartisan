import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "iArtisan Admin",
  description: "Back-office iArtisan — Gestion clients, leads & abonnements",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
