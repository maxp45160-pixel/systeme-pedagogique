"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { A_VENIR, NAVIGATION } from "./navigation";
import { cx } from "@/components/ui/primitives";
import { IconeFeuille } from "@/components/ui/icones";
import { BasculeTheme } from "./bascule-theme";
import { Compte, type EtatSession } from "./compte";

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

export function Sidebar({
  xp,
  mode,
  session,
}: {
  xp: ResumeXp;
  mode: "reel" | "demo";
  session: EtatSession;
}) {
  const pathname = usePathname();
  const surAccueil = pathname === "/";
  const remplissage = Math.max(0, Math.min(1, xp.fraction)) * 100;

  return (
    // Rabat de carnet « forêt » : sombre et constant dans les deux thèmes, il
    // encadre le canevas crème et concentre le regard sur le travail.
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-[var(--rail-bordure)] bg-[var(--rail)] text-[var(--rail-texte)] lg:flex">
      {/* Logo = tableau de bord : le point d'entrée, plus un « groupe » à part. */}
      <div className="flex h-16 items-center justify-between gap-2 border-b border-[var(--rail-bordure)] px-4">
        <Link
          href="/"
          aria-current={surAccueil ? "page" : undefined}
          className="group flex min-w-0 items-center gap-2.5"
        >
          <span
            className={cx(
              "flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--rail-actif)] text-[var(--rail-actif-texte)] transition-shadow",
              surAccueil && "ring-2 ring-[var(--rail-actif)]/40 ring-offset-2 ring-offset-[var(--rail)]",
            )}
          >
            <IconeFeuille className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-serif text-[0.95rem] font-medium leading-tight text-[var(--rail-texte)]">
              Carnet
            </span>
            <span className="block truncate text-[0.6875rem] text-[var(--rail-texte-discret)]">
              Tableau de bord
            </span>
          </span>
        </Link>
        <BasculeTheme tone="rail" />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAVIGATION.map((groupe) => (
          <div key={groupe.titre} className={groupe.primaire ? "mb-6" : "mb-6"}>
            <div
              className={cx(
                "px-2 pb-2 text-[0.625rem] font-semibold uppercase tracking-wider",
                groupe.primaire ? "text-[var(--rail-texte-attenue)]" : "text-[var(--rail-texte-discret)]",
              )}
            >
              {groupe.titre}
            </div>
            <ul className={groupe.primaire ? "space-y-1" : "space-y-0.5"}>
              {groupe.entrees.map((e) => {
                const actif = estActif(pathname, e.href);
                const Icone = e.icone;
                return (
                  <li key={e.href}>
                    <Link
                      href={e.href}
                      aria-current={actif ? "page" : undefined}
                      className={cx(
                        "group flex items-center transition-colors",
                        groupe.primaire
                          ? "gap-3 rounded-lg px-3 py-2.5 text-sm font-medium"
                          : "gap-2.5 rounded-md px-3 py-1.5 text-[0.8125rem]",
                        actif
                          ? groupe.primaire
                            ? "bg-[var(--rail-actif)] text-[var(--rail-actif-texte)] shadow-sm"
                            : "bg-white/10 font-medium text-[var(--rail-texte)]"
                          : "text-[var(--rail-texte-attenue)] hover:bg-white/5 hover:text-[var(--rail-texte)]",
                      )}
                    >
                      <Icone
                        className={cx(
                          "shrink-0",
                          groupe.primaire ? "size-[18px]" : "size-4",
                          !actif && "text-[var(--rail-texte-discret)] group-hover:text-[var(--rail-texte-attenue)]",
                        )}
                      />
                      <span className="truncate">{e.libelle}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {/* Fonctionnalités à venir : nettement séparées, discrètes, non cliquables. */}
        <div className="mt-2 border-t border-[var(--rail-bordure)] pt-4">
          <div className="px-2 pb-2 text-[0.625rem] font-semibold uppercase tracking-wider text-[var(--rail-texte-discret)]">
            Bientôt
          </div>
          <ul className="space-y-0.5 opacity-60">
            {A_VENIR.map((e) => {
              const Icone = e.icone;
              return (
                <li key={e.href}>
                  <div className="flex cursor-default items-center gap-2.5 rounded-md px-3 py-1.5 text-[0.8125rem] text-[var(--rail-texte-discret)]">
                    <Icone className="size-4 shrink-0 opacity-70" />
                    <span className="truncate">{e.libelle}</span>
                    <span className="ml-auto text-[0.5625rem] uppercase tracking-wide">bientôt</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/*
        Progression du niveau : indicateur secondaire, en pied de rail. La
        matrice de compétences reste l'information principale du système.
      */}
      <div className="border-t border-[var(--rail-bordure)] p-3">
        <div className="rounded-xl border border-[var(--rail-bordure)] bg-[var(--rail-2)] px-3 py-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-serif text-sm font-medium text-[var(--rail-texte)]">
              Niveau {xp.niveau}
            </span>
            <span className="chiffres text-[0.6875rem] text-[var(--rail-texte-discret)]">
              {xp.xpTotal} XP
            </span>
          </div>
          <div className="mt-0.5 text-[0.625rem] text-[var(--rail-texte-discret)]">{xp.nom}</div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/25">
            <div
              className="h-full rounded-full bg-[var(--rail-actif)] transition-[width] duration-500"
              style={{ width: `${remplissage}%` }}
            />
          </div>
          <div className="mt-1.5 text-[0.625rem] text-[var(--rail-texte-discret)]">
            {xp.suivant
              ? `${xp.xpRequisPalier - xp.xpDansPalier} XP avant « ${xp.suivant} »`
              : "Dernier palier atteint"}
          </div>
          {mode === "demo" && (
            <div className="mt-2 rounded-md border border-[#d99a3f]/30 bg-[#d99a3f]/10 py-1 text-center text-[0.625rem] font-medium text-[#d99a3f]">
              Données fictives
            </div>
          )}
        </div>
      </div>
      <Compte session={session} />
    </aside>
  );
}
