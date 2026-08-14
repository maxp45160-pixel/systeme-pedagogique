import Link from "next/link";
import type { ReactNode } from "react";
import { classesLienBouton } from "@/components/ui/primitives";

/**
 * Le chrome d'un espace de travail du Cahier.
 *
 * Même forme que le workspace de séance (`vue-seance-detail`) : plein écran,
 * en-tête collant, et une sortie toujours visible. Un espace de travail qui
 * couvre l'écran sans dire comment en sortir n'est pas un mode focus, c'est une
 * impasse — c'était le défaut des écrans d'activité, qui remplaçaient la page
 * sans rien remettre à la place de la navigation.
 */
export function CoquilleWorkspace({
  surtitre,
  titre,
  children,
}: {
  surtitre: string;
  titre: string;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-surface">
      <header className="sticky top-0 z-20 border-b border-bordure bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-[0.6875rem] uppercase tracking-wider text-texte-discret">{surtitre}</p>
            <h1 className="mt-0.5 truncate font-serif text-lg font-medium">{titre}</h1>
          </div>
          <Link href="/seances" className={classesLienBouton("secondaire", "petite")}>
            Sortir vers le cahier
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6">{children}</main>
    </div>
  );
}
