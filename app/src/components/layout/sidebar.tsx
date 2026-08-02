"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAVIGATION } from "./navigation";
import { cx } from "@/components/ui/primitives";
import { BasculeRail } from "./bascule-rail";
import { Compte, type EtatSession } from "./compte";

function estActif(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ session }: { session: EtatSession }) {
  const pathname = usePathname();

  return (
    // Rabat de carnet « forêt » : sombre et constant dans les deux thèmes, il
    // encadre le canevas crème et concentre le regard sur le travail.
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-[var(--rail-bordure)] bg-[var(--rail)] text-[var(--rail-texte)] lg:flex rail-reduit:w-16">
      {/* En-tête : nom du système (déployé) + bascule de réduction. */}
      <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-[var(--rail-bordure)] px-4 rail-reduit:justify-center rail-reduit:px-0">
        <span className="min-w-0 truncate font-serif text-[0.95rem] font-medium leading-tight text-[var(--rail-texte)] rail-reduit:hidden">
          Système pédagogique
        </span>
        <BasculeRail />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 rail-reduit:px-2">
        {NAVIGATION.map((groupe) => (
          <div key={groupe.titre} className="mb-6 last:mb-0">
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

      <Compte session={session} />
    </aside>
  );
}