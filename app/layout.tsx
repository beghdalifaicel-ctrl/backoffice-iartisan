import "./globals.css";
import type { Metadata } from "next";
import { Analytics } from "./components/Analytics";

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: "iArtisan — Assistants IA pour artisans du BTP",
    template: "%s | iArtisan",
  },
  description: "Vos agents IA gèrent appels, devis, factures, Google Business, prospection et relances. Essai gratuit 14 jours — sans engagement.",
  metadataBase: new URL("https://iartisan.io"),
  alternates: {
    canonical: "https://iartisan.io",
  },
  openGraph: {
    title: "iArtisan — Assistants IA pour artisans du BTP",
    description: "Marie, Lucas et Samir gèrent votre administratif, marketing et commercial pendant que vous êtes sur vos chantiers.",
    url: "https://iartisan.io",
    siteName: "iArtisan",
    locale: "fr_FR",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "iArtisan — 3 agents IA pour artisans du BTP",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "iArtisan — Assistants IA pour artisans du BTP",
    description: "3 agents IA qui gèrent votre admin, marketing et commercial. Essai gratuit 14 jours.",
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "iArtisan",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: "Assistants IA pour artisans du BTP — gestion des appels, devis, factures, prospection et relances automatisées.",
  url: "https://iartisan.io",
  offers: {
    "@type": "AggregateOffer",
    lowPrice: "49",
    highPrice: "179",
    priceCurrency: "EUR",
    offerCount: "3",
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.8",
    reviewCount: "47",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
