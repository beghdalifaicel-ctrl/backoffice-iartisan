import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "iArtisan — Assistants IA pour artisans du BTP",
  description: "Vos agents IA gèrent emails, devis, factures, Google Business, prospection et relances. 14 jours d'essai gratuit.",
  metadataBase: new URL("https://app.iartisan.io"),
  openGraph: {
    title: "iArtisan — Assistants IA pour artisans du BTP",
    description: "Alice, Marc et Léa gèrent votre administratif, marketing et commercial pendant que vous êtes sur vos chantiers.",
    url: "https://app.iartisan.io",
    siteName: "iArtisan",
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "iArtisan — Assistants IA pour artisans du BTP",
    description: "3 agents IA qui gèrent votre admin, marketing et commercial. 14 jours d'essai gratuit.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
