import type { Metadata } from "next";
import Script from "next/script";
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

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://systeme-pedagogique-nine.vercel.app");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Système pédagogique — apprendre par la pratique",
    template: "%s | Système pédagogique",
  },
  description:
    "Maîtrisez n'importe quel sujet par la pratique : des exercices sur mesure, et un niveau qui reflète ce que vous savez vraiment faire.",
  keywords: [
    "système pédagogique",
    "apprendre par la pratique",
    "exercices sur mesure",
    "suivi des compétences",
    "progression mesurée",
    "auto-formation",
    "tuteur pédagogique",
  ],
  authors: [{ name: "Système Pédagogique" }],
  creator: "Système Pédagogique",
  openGraph: {
    title: "Système pédagogique — apprendre par la pratique",
    description:
      "Des exercices sur vos sujets, et un niveau qui reflète ce que vous savez vraiment faire.",
    url: siteUrl,
    siteName: "Système Pédagogique",
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Système pédagogique — apprendre par la pratique",
    description:
      "Maîtrisez n'importe quel sujet par la pratique, et voyez où vous en êtes vraiment.",
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
        {/*
          * `next/script`, jamais un `<script>` brut rendu par un composant :
          * React n'exécute pas les balises script qu'il re-rend côté client et
          * journalise l'erreur « Encountered a script tag while rendering ».
          * `beforeInteractive` garde la garantie d'origine — le thème et l'état
          * du rail sont posés AVANT la première peinture, sans clignotement.
          */}
        <Script
          id="preferences-appareil"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: SCRIPT_PREFERENCES }}
        />
        {/* Données structurées pour les moteurs de recherche : à lire, pas à exécuter. */}
        <Script
          id="json-ld-application"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD_APPLICATION) }}
        />
      </head>
      <body className="min-h-full">
        {children}
      </body>
    </html>
  );
}
