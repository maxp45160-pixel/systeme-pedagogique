import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Serif d'affichage : titres, dates, chiffres-héros. Le corps reste en sans.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://systeme-pedagogique.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Système pédagogique — Suivi longitudinal des compétences",
    template: "%s | Système pédagogique",
  },
  description:
    "Centre de pilotage et d'apprentissage adaptatif : génération d'exercices ciblés, évaluation continue et suivi longitudinal des compétences en ingénierie des systèmes complexes.",
  keywords: [
    "système pédagogique",
    "suivi longitudinal des compétences",
    "apprentissage adaptatif",
    "ingénierie des systèmes complexes",
    "évaluation pédagogique",
    "référentiel de compétences",
    "tuteur pédagogique",
  ],
  authors: [{ name: "Système Pédagogique" }],
  creator: "Système Pédagogique",
  openGraph: {
    title: "Système pédagogique — Suivi longitudinal des compétences",
    description:
      "Génération d'exercices ciblés, évaluation continue et suivi longitudinal du développement de compétences.",
    url: siteUrl,
    siteName: "Système Pédagogique",
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Système pédagogique — Suivi longitudinal des compétences",
    description:
      "Centre de pilotage et d'apprentissage adaptatif des compétences en ingénierie des systèmes.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "PYH66AATHwISN6RusvDJafbdLlJN0tnKYN5iTK0e19E",
  },
};

const JSON_LD_APPLICATION = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Système Pédagogique",
  applicationCategory: "EducationalApplication",
  operatingSystem: "All",
  description:
    "Centre de pilotage et d'apprentissage adaptatif : génération d'exercices ciblés, évaluation continue et suivi longitudinal des compétences.",
  inLanguage: "fr",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "EUR",
  },
};

/**
 * Positionne le thème et l'état du rail avant la première peinture, pour éviter
 * le clignotement. Pour le thème : préférence explicite si elle existe, sinon
 * préférence système. Pour le rail : `data-rail="reduit"` seulement si l'état
 * réduit a été choisi — l'absence d'attribut vaut « rail complet ».
 */
const SCRIPT_PREFERENCES = `(function(){try{var t=localStorage.getItem('theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'clair'}document.documentElement.setAttribute('data-theme',t);if(localStorage.getItem('rail')==='reduit'){document.documentElement.setAttribute('data-rail','reduit')}}catch(e){document.documentElement.setAttribute('data-theme','clair')}})()`;

/**
 * Coque minimale : polices, thème, `<html>`/`<body>`.
 *
 * Le carnet lui-même (rail de navigation, bandeau, marge) vit dans le groupe
 * de routes `(app)`. L'écran de connexion n'a donc pas à masquer un cadre
 * qu'il n'a jamais rendu — et surtout, il ne déclenche pas le chargement du
 * contexte pédagogique pour un visiteur qui n'a pas encore de compte.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_PREFERENCES }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD_APPLICATION) }}
        />
      </head>
      <body className="min-h-full">
        {children}
      </body>
    </html>
  );
}
