"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAVIGATION } from "./navigation";
import { BarreProgression, cx, Etiquette } from "@/components/ui/primitives";
import { BasculeTheme } from "./bascule-theme";

export interface ResumeXp {
  niveau: number;
  nom: string;
  xpTotal: number;
  fraction: number;
  xpDansPalier: number;
  xpRequisPalier: number;
  suivant: string | null;
}

function estActif(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ xp, mode }: { xp: ResumeXp; mode: "reel" | "demo" }) {
  const pathname = usePathname();

  return (
    // Barre fixée : sur les pages longues (progression, compétences), la
    // navigation doit rester atteignable sans remonter.
    <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-bordure bg-surface lg:flex">
      <div className="flex h-14 items-center justify-between gap-2 border-b border-bordure px-4">
        <Link href="/" className="min-w-0">
          <div className="truncate text-sm font-semibold tracking-tight">Système pédagogique</div>
          <div className="truncate text-[0.6875rem] text-texte-discret">
            Suivi longitudinal des compétences
          </div>
        </Link>
        <BasculeTheme />
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {NAVIGATION.map((groupe) => (
          <div key={groupe.titre} className="mb-4 last:mb-0">
            <div className="px-2 pb-1 text-[0.625rem] font-semibold uppercase tracking-wider text-texte-discret">
              {groupe.titre}
            </div>
            <ul className="space-y-0.5">
              {groupe.entrees.map((e) => {
                const actif = estActif(pathname, e.href);
                const Icone = e.icone;
                return (
                  <li key={e.href}>
                    <Link
                      href={e.href}
                      aria-current={actif ? "page" : undefined}
                      className={cx(
                        "group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                        actif
                          ? "bg-primaire-faible font-medium text-primaire"
                          : "text-texte-attenue hover:bg-surface-2 hover:text-texte",
                      )}
                    >
                      <Icone className={cx("size-[17px] shrink-0", !actif && "text-texte-discret")} />
                      <span className="truncate">{e.libelle}</span>
                      {e.aVenir && (
                        <span className="ml-auto text-[0.625rem] text-texte-discret">à venir</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/*
        Le niveau global est délibérément en pied de barre, en petit : c'est un
        indicateur secondaire. La matrice de compétences reste l'information
        principale du système.
      */}
      <div className="border-t border-bordure px-3 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-medium">
            Niveau {xp.niveau} · {xp.nom}
          </span>
          <span className="chiffres text-[0.6875rem] text-texte-discret">{xp.xpTotal} XP</span>
        </div>
        <BarreProgression fraction={xp.fraction} className="mt-1.5" />
        <div className="mt-1 text-[0.625rem] text-texte-discret">
          {xp.suivant
            ? `${xp.xpRequisPalier - xp.xpDansPalier} XP avant « ${xp.suivant} »`
            : "Dernier palier atteint"}
        </div>
        {mode === "demo" && (
          <Etiquette ton="alerte" className="mt-2 w-full justify-center">
            Données fictives
          </Etiquette>
        )}
      </div>
    </aside>
  );
}
