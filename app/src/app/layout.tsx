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

export const metadata: Metadata = {
  title: "Système pédagogique — Suivi longitudinal",
  description:
    "Centre de pilotage personnel du développement de compétences en ingénierie des systèmes complexes.",
};

/**
 * Positionne le thème avant la première peinture, pour éviter le clignotement.
 * Préférence explicite si elle existe, sinon préférence système.
 */
const SCRIPT_THEME = `(function(){try{var t=localStorage.getItem('theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'clair'}document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','clair')}})()`;

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
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_THEME }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
