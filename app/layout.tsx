import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google"; // Importation optimisée
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

// Configuration des polices pour éviter le FOIT (Flash of Invisible Text)
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap", // Crucial pour le CLS
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://vagondys.com"),
  title: "VAGONDYS",
  description: "Maison d’élite d'airsoft — Discipline, Compétition, Maîtrise",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "VAGONDYS",
    description: "Maison d’élite d'airsoft — Discipline, Compétition, Maîtrise",
    url: "https://vagondys.com",
    siteName: "VAGONDYS",
    locale: "fr_FR",
    type: "website",
    images: [
      {
        url: "/logo/vagondys.png",
        width: 1200,
        height: 800,
        alt: "VAGONDYS Logo",
      },
    ],
  },
  manifest: "https://vagondys.com/manifest.webmanifest",
};

// Sécurise le comportement sur mobile pour éviter les décalages de barre d'adresse
export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="bg-black">
      <body 
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-black text-white`}
      >
        {/* On enveloppe le contenu pour garantir une structure stable */}
        {children}

        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
