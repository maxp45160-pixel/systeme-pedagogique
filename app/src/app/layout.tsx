import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { chargerContexte } from "@/lib/store/context";
import { Sidebar } from "@/components/layout/sidebar";
import { NavMobile } from "@/components/layout/nav-mobile";
import { BandeauDemo } from "@/components/layout/bandeau-demo";
import { BasculeTheme } from "@/components/layout/bascule-theme";

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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { xp, mode } = await chargerContexte();

  const resumeXp = {
    niveau: xp.palier.niveau,
    nom: xp.palier.nom,
    xpTotal: xp.xpTotal,
    fraction: xp.fraction,
    xpDansPalier: xp.xpDansPalier,
    xpRequisPalier: xp.xpRequisPalier,
    suivant: xp.suivant?.nom ?? null,
  };

  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_THEME }} />
      </head>
      <body className="min-h-full">
        <div className="flex min-h-screen">
          <Sidebar xp={resumeXp} mode={mode} />

          <div className="flex min-w-0 flex-1 flex-col">
            {mode === "demo" && <BandeauDemo />}

            {/* Barre supérieure mobile : le nom du système et la bascule de thème. */}
            <div className="flex h-12 items-center justify-between gap-2 border-b border-bordure bg-surface px-4 lg:hidden">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold tracking-tight">
                  Système pédagogique
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="chiffres text-[0.6875rem] text-texte-discret">
                  N{resumeXp.niveau} · {resumeXp.xpTotal} XP
                </span>
                <BasculeTheme />
              </div>
            </div>

            <main className="flex-1 px-4 pb-20 pt-5 sm:px-6 lg:px-8 lg:pb-10">
              {/* Marge de carnet : filet terracotta discret le long du contenu (desktop). */}
              <div className="mx-auto w-full max-w-6xl lg:border-l lg:border-danger/15 lg:pl-10">
                {children}
              </div>
            </main>
          </div>
        </div>

        <NavMobile />
      </body>
    </html>
  );
}
