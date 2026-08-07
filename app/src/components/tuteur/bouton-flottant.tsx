"use client";

/**
 * Bouton flottant du tuteur — accessible depuis n'importe quelle page.
 *
 * Un `<Link>` natif plutôt qu'un `router.push` : la navigation fonctionne
 * dès le premier rendu, indépendamment de l'hydratation, et ouvre bien la
 * page /tuteur en pleine fenêtre.
 */

import Link from "next/link";
import { cx } from "@/components/ui/primitives";

export function BoutonTuteurFlottant() {
  return (
    <Link
      href="/tuteur"
      aria-label="Ouvrir le tuteur"
      title="Ouvrir le tuteur"
      className={cx(
        "fixed bottom-6 right-6 z-40 flex size-12 items-center justify-center",
        "rounded-full bg-primaire text-primaire-contraste shadow-lg",
        "transition-transform hover:scale-105 active:scale-95",
        "focus:outline-none focus:ring-2 focus:ring-primaire focus:ring-offset-2",
      )}
    >
      <span className="text-lg font-bold" aria-hidden>
        💬
      </span>
    </Link>
  );
}