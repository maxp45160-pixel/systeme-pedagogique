"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { classesLienBouton } from "@/components/ui/primitives";
import { OutilSeance } from "@/components/seances/outil-seance";
import { Pomodoro } from "@/components/seances/pomodoro";
import { TiroirTuteur } from "@/components/tuteur/tiroir-tuteur";

/**
 * Le chrome d'un espace de travail documentaire de l'Atelier.
 *
 * Plein écran, en-tête collant, et une sortie toujours visible vers l'Atelier.
 */
const SORTIE_PAR_DEFAUT = { href: "/atelier", libelle: "Retour à mes cours" } as const;

export function sortieWorkspace(retour?: string): { href: string; libelle: string } {
  if (!retour) return SORTIE_PAR_DEFAUT;
  if (retour.startsWith("/seances")) {
    return { href: retour, libelle: "Retour aux séances" };
  }
  if (retour === "/" || retour.startsWith("/?")) {
    return { href: retour, libelle: "Retourner au tableau de bord" };
  }
  return { href: retour, libelle: "Retour" };
}

export function CoquilleWorkspace({
  surtitre,
  titre,
  compteId,
  sortie = SORTIE_PAR_DEFAUT,
  barre,
  children,
}: {
  surtitre: string;
  titre: string;
  /** Compte courant nécessaire aux outils qui vivent dans le workspace. */
  compteId?: string;
  /**
   * Où mène la sortie. Un espace de travail ouvert depuis l'Atelier ramène à l'Atelier.
   */
  sortie?: { href: string; libelle: string };
  /** Bandeau pleine largeur sous la ligne de titre, dans l'en-tête collant. */
  barre?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();

  const handleRetour = (e: React.MouseEvent) => {
    if (sortie.href === "/atelier" && typeof window !== "undefined" && window.history.length > 1) {
      e.preventDefault();
      router.back();
    }
  };

  return (
    <div className="fixed inset-0 z-[var(--superposition-modale)] overflow-y-auto bg-surface">
      <header className="sticky top-0 z-20 border-b border-bordure bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-[0.6875rem] uppercase tracking-wider text-texte-discret">{surtitre}</p>
            <h1 className="mt-0.5 truncate font-serif text-lg font-medium">{titre}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {compteId && (
              <>
                <OutilSeance
                  libelle="Pomodoro"
                  contenuClassName="absolute right-0 top-full z-30 mt-2 w-[min(22rem,calc(100vw-2rem))]"
                >
                  <Pomodoro compteId={compteId} />
                </OutilSeance>
                <TiroirTuteur declencheur="bouton" libelle="Tuteur" />
              </>
            )}
            <Link
              href={sortie.href}
              onClick={handleRetour}
              className={classesLienBouton("secondaire", "petite")}
            >
              {sortie.libelle}
            </Link>
          </div>
          {barre && <div className="basis-full">{barre}</div>}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6">{children}</main>
    </div>
  );
}
