"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_MOBILE } from "./navigation";
import { cx } from "@/components/ui/primitives";

/** Barre inférieure sur mobile : les cinq destinations effectivement utiles. */
export function NavMobile() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-bordure bg-surface/95 backdrop-blur-sm lg:hidden">
      <ul className="grid grid-cols-5">
        {NAV_MOBILE.map((e) => {
          const actif = e.href === "/" ? pathname === "/" : pathname.startsWith(e.href);
          const Icone = e.icone;
          return (
            <li key={e.href}>
              <Link
                href={e.href}
                aria-current={actif ? "page" : undefined}
                className={cx(
                  "flex flex-col items-center gap-0.5 py-2 text-[0.625rem] transition-colors",
                  actif ? "text-primaire" : "text-texte-discret",
                )}
              >
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
