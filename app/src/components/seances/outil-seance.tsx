"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { classesIntercalaire, classesLienBouton, cx } from "@/components/ui/primitives";

/** Outil flottant du workspace, refermé dès qu'un clic sort de son panneau. */
export function OutilSeance({
  libelle,
  children,
  contenuClassName,
  variante = "bouton",
}: {
  libelle: string;
  children: ReactNode;
  contenuClassName: string;
  /**
   * `intercalaire` : la languette d'un séparateur de cahier, pour les outils
   * de la séance en cours. `bouton` : partout ailleurs — le calendrier, par
   * exemple, n'appartient pas au workspace.
   */
  variante?: "bouton" | "intercalaire";
}) {
  const [ouvert, setOuvert] = useState(false);
  const racine = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouvert) return;

    function fermerSiExterieur(event: PointerEvent) {
      if (event.target instanceof Node && !racine.current?.contains(event.target)) {
        setOuvert(false);
      }
    }

    function fermerAvecEchap(event: KeyboardEvent) {
      if (event.key === "Escape") setOuvert(false);
    }

    document.addEventListener("pointerdown", fermerSiExterieur);
    document.addEventListener("keydown", fermerAvecEchap);
    return () => {
      document.removeEventListener("pointerdown", fermerSiExterieur);
      document.removeEventListener("keydown", fermerAvecEchap);
    };
  }, [ouvert]);

  return (
    <div ref={racine} className="relative">
      <button
        type="button"
        onClick={() => setOuvert((actuel) => !actuel)}
        aria-expanded={ouvert}
        className={
          variante === "intercalaire"
            ? classesIntercalaire(ouvert)
            : cx(classesLienBouton("secondaire", "petite"), "cursor-pointer")
        }
      >
        {libelle}
      </button>
      {ouvert && <div className={contenuClassName}>{children}</div>}
    </div>
  );
}
