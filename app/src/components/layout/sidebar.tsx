"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { estActif, navigationPour } from "./navigation";
import { cx } from "@/components/ui/primitives";
import { BasculeRail } from "./bascule-rail";
import { Compte, type EtatSession } from "./compte";
import { PastillePomodoroGlobale } from "@/components/dashboard/pomodoro";
import { BoutonIntentionRail } from "@/components/intention/bouton-intention";

export function Sidebar({
  session,
  administrateur = false,
}: {
  session: EtatSession;
  /** Ajoute l'entrée « Comptes et accès ». Affichage seulement — voir `navigationPour`. */
  administrateur?: boolean;
}) {
  const pathname = usePathname();
  const groupes = navigationPour(administrateur);

  return (
    // Rabat de carnet « forêt » : sombre et constant dans les deux thèmes, il
    // encadre le canevas crème et concentre le regard sur le travail.
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-[var(--rail-bordure)] bg-[var(--rail)] text-[var(--rail-texte)] lg:flex rail-reduit:w-16">
      {/* En-tête : bascule de réduction + nom du système (déployé). */}
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-[var(--rail-bordure)] px-[18px] rail-reduit:justify-center rail-reduit:px-0">
        <BasculeRail />
        <span className="min-w-0 truncate font-serif text-[0.95rem] font-medium leading-tight text-[var(--rail-texte)] rail-reduit:hidden">
          Système pédagogique
        </span>
      </div>

      {/*
        `flex flex-col` sur la nav : c'est ce qui donne prise au `mt-auto` du
        groupe détaché. Sans lui, la marge auto n'a rien à repousser et « Aide »
        resterait collée au Cahier.
      */}
      <nav data-tour="navigation-rail" className="flex flex-1 flex-col overflow-y-auto px-3 py-4 rail-reduit:px-2">
        {/*
          Le `+` est posé au-dessus des destinations, et hors des groupes : ce
          n'est pas un endroit où aller, c'est le geste qu'on veut déclencher.
          Le mettre dans « Piloter » ou « Travailler » l'aurait rangé parmi des
          pages, ce qu'il n'est pas.
        */}
        <div className="mb-6">
          <BoutonIntentionRail />
        </div>

        {groupes.map((groupe) => (
          <div
            key={groupe.titre}
            className={cx(
              "mb-6 last:mb-0",
              // Un groupe détaché est poussé au bas du rail par sa marge auto,
              // et séparé par un filet : il n'appartient pas à la liste des
              // pôles de travail qui le précède.
              groupe.aPart && "mt-auto border-t border-[var(--rail-bordure)] pt-4",
            )}
          >
            <div
              className={cx(
                "px-2 pb-2 text-[0.625rem] font-semibold uppercase tracking-wider rail-reduit:hidden",
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
                      // Le nom accessible ne doit jamais dépendre du CSS : en
                      // rail réduit le libellé visible disparaît, `aria-label`
                      // et `title` restent.
                      aria-label={e.libelle}
                      title={e.libelle}
                      className={cx(
                        "group flex items-center transition-colors rail-reduit:justify-center rail-reduit:px-0",
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
                      <span className="truncate rail-reduit:hidden">{e.libelle}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="px-3 py-2 flex justify-center rail-reduit:hidden">
        <PastillePomodoroGlobale compteId={session.compteId} />
      </div>

      <Compte session={session} />
    </aside>
  );
}