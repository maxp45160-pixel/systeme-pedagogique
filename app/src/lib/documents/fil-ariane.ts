import type { NoeudDossier } from "./arbre-atelier";

export interface SegmentFilAriane {
  libelle: string;
  cheminCumule: string;
  cible?: {
    type: "element" | "dossier";
    idOuChemin: string;
  };
}

export interface ElementIdentifiablePourFilAriane {
  id: string;
  titre?: string;
  type: string;
  domaineId?: string;
  vuePedagogique?: {
    kind: string;
    nom?: string;
  };
}

export interface ParametresFilAriane {
  dossier: string;
  titreCourant: string;
  elements?: ElementIdentifiablePourFilAriane[];
  arbreDossiers?: NoeudDossier<any>[];
}

export interface FilArianeResolu {
  segments: SegmentFilAriane[];
  titreCourant: string;
}

/**
 * Dérive de façon pure et dynamique les segments navigables du fil d'Ariane
 * à partir du chemin de dossier et des entités de l'Atelier.
 */
export function resoudreSegmentsFilAriane({
  dossier,
  titreCourant,
  elements = [],
  arbreDossiers = [],
}: ParametresFilAriane): FilArianeResolu {
  const parties = dossier
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);

  const segments: SegmentFilAriane[] = parties.map((partie, index) => {
    const cheminCumule = parties.slice(0, index + 1).join("/");

    // 1. Racines spéciales d'affichage
    if (partie === "Domaines") {
      return {
        libelle: partie,
        cheminCumule,
        cible: { type: "element", idOuChemin: "domaines" },
      };
    }

    if (partie === "Transversal") {
      return {
        libelle: partie,
        cheminCumule,
        cible: { type: "element", idOuChemin: "transversal" },
      };
    }

    if (partie === "Domaines archivés" || partie === "Archivés") {
      return {
        libelle: partie,
        cheminCumule,
        cible: { type: "element", idOuChemin: "domaines-archives" },
      };
    }

    // 2. Domaine existant identifié par son nom ou son titre
    const domaineEl = elements.find(
      (el) =>
        el.type === "domaine" &&
        ((el.vuePedagogique?.kind === "domaine" && el.vuePedagogique.nom === partie) ||
          el.titre === partie ||
          el.domaineId === partie),
    );

    if (domaineEl) {
      return {
        libelle: partie,
        cheminCumule,
        cible: { type: "element", idOuChemin: domaineEl.id },
      };
    }

    // 3. Dossier ou sous-catégorie intermédiaire (ex: "Transversal/Thèmes", "Domaines/Maths/Exercices")
    return {
      libelle: partie,
      cheminCumule,
      cible: { type: "dossier", idOuChemin: cheminCumule },
    };
  });

  return {
    segments,
    titreCourant,
  };
}
