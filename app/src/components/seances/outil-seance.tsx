"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { classesOutilSeance, classesLienBouton, cx } from "@/components/ui/primitives";

/** Outil flottant du workspace, refermé dès qu'un clic sort de son panneau. */
export function OutilSeance({
  libelle,
  icone,
  indice,
  children,
  contenuClassName,
  variante = "bouton",
}: {
  libelle: string;
  /**
   * Icône du déclencheur. En variante `discret`, elle remplace le libellé —
   * qui reste alors le nom accessible : il ne disparaît jamais, il cesse
   * seulement d'être peint.
   */
  icone?: ReactNode;
  /**
   * Compteur posé à droite du libellé (variante `outil`) : « 1/3 » sur les
   * exercices, le nombre de lignes ouvertes sur la marge. Absent quand il n'y
   * a rien à compter — un « 0 » permanent est du bruit.
   */
  indice?: ReactNode;
  children: ReactNode;
  contenuClassName: string;
  /**
   * `outil` : un contrôle de l'espace de travail — fond, contour, état actif
   * lisible (ADR-101). `bouton` : partout ailleurs. `discret` : la barre
   * d'outils du Bureau, où un libellé écrit par contrôle ferait quatre mots
   * de plus sur le seul écran qu'on veut silencieux.
   */
  variante?: "bouton" | "outil" | "discret";
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
        aria-label={variante === "discret" ? libelle : undefined}
        title={variante === "discret" ? libelle : undefined}
        className={
          variante === "outil"
            ? classesOutilSeance(ouvert)
            : variante === "discret"
              ? cx(
                  "flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-surface-2 hover:text-texte",
                  ouvert ? "bg-surface-2 text-texte" : "text-texte-discret",
                )
              : cx(classesLienBouton("secondaire", "petite"), "cursor-pointer")
        }
      >
        {variante === "discret" ? (
          (icone ?? libelle)
        ) : (
          <>
            {variante === "outil" && icone}
            {libelle}
            {variante === "outil" && indice !== undefined && (
              <span className="chiffres text-[0.6875rem] text-texte-discret">{indice}</span>
            )}
          </>
        )}
      </button>
      {ouvert && <div className={contenuClassName}>{children}</div>}
    </div>
  );
}
