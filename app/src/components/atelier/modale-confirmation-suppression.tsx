"use client";

import { useState, useTransition } from "react";
import { Modale } from "@/components/ui/modale";
import { Bouton, cx } from "@/components/ui/primitives";

export function BoutonSuppressionCarte({
  onClick,
  titre = "Supprimer cet élément",
  className,
}: {
  onClick: (e: React.MouseEvent) => void;
  titre?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      className={cx(
        "absolute right-3 top-3 z-10 grid size-7 place-items-center rounded-lg border border-transparent text-texte-discret opacity-0 transition-all duration-150 group-hover:opacity-70 hover:!opacity-100 hover:border-danger/30 hover:bg-danger-faible hover:text-danger focus:opacity-100 cursor-pointer",
        className,
      )}
      title={titre}
      aria-label={titre}
    >
      <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18" />
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
      </svg>
    </button>
  );
}

export interface ModaleConfirmationSuppressionProps {
  titre: string;
  nomElement: string;
  typeElement: "domaine" | "competence" | "theme" | "document" | "exercice";
  mode?: "suppression" | "archivage";
  explication?: string;
  onConfirmer: () => Promise<void> | void;
  onFermer: () => void;
  texteBoutonConfirmer?: string;
}

export function ModaleConfirmationSuppression({
  titre,
  nomElement,
  mode = "suppression",
  explication,
  onConfirmer,
  onFermer,
  texteBoutonConfirmer,
}: ModaleConfirmationSuppressionProps) {
  const [enCours, demarrerTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const estArchivage = mode === "archivage";
  const libelleBouton = texteBoutonConfirmer ?? (estArchivage ? "Confirmer l’archivage" : "Supprimer définitivement");

  const messageParDefaut = estArchivage
    ? "Cet élément contient des données ou un historique d’apprentissage. Il sera archivé en toute sécurité : ses preuves restent conservées et ne sont jamais supprimées."
    : "Cet élément ne porte aucun historique ni observation directe. Il sera retiré de votre espace.";

  function executer() {
    setErreur(null);
    demarrerTransition(async () => {
      try {
        await onConfirmer();
        onFermer();
      } catch (err) {
        setErreur(err instanceof Error ? err.message : "Une erreur est survenue lors de l'opération.");
      }
    });
  }

  return (
    <Modale
      titre={titre}
      largeur="md"
      onFermer={() => {
        if (!enCours) onFermer();
      }}
      pied={
        <div className="flex w-full items-center justify-end gap-2.5">
          <Bouton
            type="button"
            variante="secondaire"
            disabled={enCours}
            onClick={onFermer}
          >
            Annuler
          </Bouton>
          <Bouton
            type="button"
            variante="danger"
            disabled={enCours}
            enChargement={enCours}
            onClick={executer}
          >
            {libelleBouton}
          </Bouton>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-bordure bg-surface-2 p-3.5">
          <span className="block text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret">
            Élément sélectionné
          </span>
          <p className="mt-1 font-serif text-base font-semibold text-texte">
            {nomElement}
          </p>
        </div>

        <p className="text-xs leading-relaxed text-texte-attenue">
          {explication || messageParDefaut}
        </p>

        {erreur && (
          <div className="rounded-lg border border-danger/30 bg-danger-faible p-3 text-xs text-danger">
            {erreur}
          </div>
        )}
      </div>
    </Modale>
  );
}
