"use client";

import { useMemo } from "react";
import { cx } from "@/components/ui/primitives";
import { BoutonRetour } from "@/components/ui/lien-retour";
import { resoudreSegmentsFilAriane } from "@/lib/documents/fil-ariane";
import type { ElementAtelier } from "./types-atelier";
import type { NoeudDossier } from "@/lib/documents/arbre-atelier";

export function BoutonOuvrirExplorateur({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid size-9 shrink-0 place-items-center rounded-lg border border-primaire/40 bg-primaire-faible text-primaire transition-all duration-200 hover:bg-primaire hover:border-primaire hover:text-white cursor-pointer shadow-xs"
      title="Ouvrir l’explorateur"
      aria-label="Ouvrir l’explorateur"
    >
      <svg className="size-5 shrink-0 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
      </svg>
    </button>
  );
}

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
  sidebarOuverte?: boolean;
  /** Fonction de bascule de l'explorateur latéral */
  setSidebarOuverte?: (ouverte: boolean) => void;
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
  sidebarOuverte = true,
  setSidebarOuverte,
  libelleRetour = "Retour à l'Atelier",
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

  const actionBoutonRetour = actionRetour ?? revenirGraphe;

  return (
    <nav
      aria-label="Fil d’Ariane"
      className={cx(
        "flex items-center gap-1.5 text-xs text-texte-discret min-w-0 flex-wrap sm:flex-nowrap",
        className,
      )}
    >
      {!sidebarOuverte && setSidebarOuverte && (
        <BoutonOuvrirExplorateur onClick={() => setSidebarOuverte(true)} />
      )}

      {actionBoutonRetour && (
        <BoutonRetour onClick={actionBoutonRetour} libelle={libelleRetour} />
      )}

      {revenirGraphe && (
        <>
          <button
            type="button"
            onClick={revenirGraphe}
            className="font-medium text-texte-discret transition-colors hover:text-primaire hover:underline shrink-0 cursor-pointer"
          >
            Atelier
          </button>
          <span className="text-texte-discret/60 shrink-0">/</span>
        </>
      )}

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
