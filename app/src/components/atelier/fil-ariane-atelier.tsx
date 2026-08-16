"use client";

import { useMemo } from "react";
import { cx } from "@/components/ui/primitives";
import { BoutonRetour } from "@/components/ui/lien-retour";
import { resoudreSegmentsFilAriane } from "@/lib/documents/fil-ariane";
import type { ElementAtelier } from "./types-atelier";
import type { NoeudDossier } from "@/lib/documents/arbre-atelier";

export interface FilArianeAtelierProps {
  /** Chemin de dossier hiérarchique (ex: "Transversal/Thèmes", "Domaines/Architecture logicielle") */
  dossier: string;
  /** Titre ou libellé de l'élément actif actuel (non cliquable) */
  titreCourant: string;
  /** Action pour revenir à la vue globale de l'Atelier (graphe) */
  revenirGraphe?: () => void;
  /** Action de navigation vers un élément (domaine, document, compétence, exercice, etc.) */
  ouvrirElement: (id: string) => void;
  /** Action directe d'ouverture d'un dossier */
  ouvrirDossier?: (chemin: string) => void;
  /** Arbre des dossiers */
  arbreDossiers?: NoeudDossier<ElementAtelier>[];
  /** Liste des éléments de l'Atelier pour retrouver les domaines */
  elements?: ElementAtelier[];
  /** État d'ouverture de l'explorateur latéral */
  /** Fonction de bascule de l'explorateur latéral */
  /** Libellé personnalisé pour le bouton de retour */
  libelleRetour?: string;
  /** Action de retour personnalisée (ex: revenir au dossier parent dans une vue catégorie) */
  actionRetour?: () => void;
  className?: string;
}

export function FilArianeAtelier({
  dossier,
  titreCourant,
  revenirGraphe,
  ouvrirElement,
  ouvrirDossier,
  arbreDossiers,
  elements,
  libelleRetour = "Retour",
  actionRetour,
  className,
}: FilArianeAtelierProps) {
  const { segments } = useMemo(
    () =>
      resoudreSegmentsFilAriane({
        dossier,
        titreCourant,
        elements,
        arbreDossiers,
      }),
    [dossier, titreCourant, elements, arbreDossiers],
  );

  const actionBoutonRetour = useMemo(() => {
    if (actionRetour) return actionRetour;
    if (segments.length > 0) {
      const dernierSegment = segments[segments.length - 1];
      if (dernierSegment?.cible) {
        if (dernierSegment.cible.type === "element") {
          const id = dernierSegment.cible.idOuChemin;
          return () => ouvrirElement(id);
        }
        if (dernierSegment.cible.type === "dossier") {
          const chemin = dernierSegment.cible.idOuChemin;
          return () => {
            if (ouvrirDossier) ouvrirDossier(chemin);
            else ouvrirElement(`dossier:${chemin}`);
          };
        }
      }
    }
    if (revenirGraphe) return revenirGraphe;
    return () => ouvrirElement("domaines");
  }, [actionRetour, segments, ouvrirElement, ouvrirDossier, revenirGraphe]);

  return (
    <nav
      aria-label="Fil d’Ariane"
      className={cx(
        "flex items-center gap-1.5 text-xs text-texte-discret min-w-0 flex-wrap sm:flex-nowrap",
        className,
      )}
    >

      {actionBoutonRetour && (
        <BoutonRetour onClick={actionBoutonRetour} libelle={libelleRetour} />
      )}

      <button
        type="button"
        onClick={() => {
          if (revenirGraphe) revenirGraphe();
          else ouvrirElement("domaines");
        }}
        className="font-medium text-texte-discret transition-colors hover:text-primaire hover:underline shrink-0 cursor-pointer"
      >
        Atelier
      </button>
      <span className="text-texte-discret/60 shrink-0">/</span>

      {segments.map((segment) => {
        let onClick: (() => void) | undefined;
        if (segment.cible) {
          if (segment.cible.type === "element") {
            const id = segment.cible.idOuChemin;
            onClick = () => ouvrirElement(id);
          } else if (segment.cible.type === "dossier") {
            const chemin = segment.cible.idOuChemin;
            onClick = () => {
              if (ouvrirDossier) {
                ouvrirDossier(chemin);
              } else {
                ouvrirElement(`dossier:${chemin}`);
              }
            };
          }
        }

        return (
          <span key={segment.cheminCumule} className="flex items-center gap-1.5 shrink-0">
            {onClick ? (
              <button
                type="button"
                onClick={onClick}
                className="font-medium text-texte-discret transition-colors hover:text-primaire hover:underline truncate max-w-[200px] cursor-pointer"
              >
                {segment.libelle}
              </button>
            ) : (
              <span className="font-medium text-texte-discret truncate max-w-[200px]">
                {segment.libelle}
              </span>
            )}
            <span className="text-texte-discret/60 shrink-0">/</span>
          </span>
        );
      })}

      <span
        className="font-semibold text-texte truncate min-w-0"
        title={titreCourant}
      >
        {titreCourant}
      </span>
    </nav>
  );
}
