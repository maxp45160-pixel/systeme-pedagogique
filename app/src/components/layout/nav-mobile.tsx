"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { estActif, NAV_MOBILE } from "./navigation";
import { cx } from "@/components/ui/primitives";

/** Barre inférieure sur mobile : les mêmes destinations que le rail desktop. */
export function NavMobile() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-bordure bg-surface/95 backdrop-blur-sm lg:hidden">
      {/*
        Nombre de colonnes dérivé de NAV_MOBILE, pas une classe Tailwind
        interpolée : le scanner de classes de Tailwind lit le texte source,
        il n'évalue rien — `grid-cols-${n}` ne produirait aucune règle.
      */}
      <ul
        className="grid"
        style={{ gridTemplateColumns: `repeat(${NAV_MOBILE.length}, minmax(0, 1fr))` }}
      >
        {NAV_MOBILE.map((e) => {
          const actif = estActif(pathname, e.href);
          const Icone = e.icone;
          return (
            <li key={e.href}>
              <Link
                href={e.href}
                aria-current={actif ? "page" : undefined}
                className={cx(
                  "relative flex flex-col items-center gap-0.5 py-2 text-[0.625rem] transition-colors",
                  actif ? "font-medium text-primaire" : "text-texte-discret hover:text-texte-attenue",
                )}
              >
                {actif && (
                  <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-primaire" aria-hidden />
                )}
                <Icone className="size-[19px]" />
                {e.court}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
