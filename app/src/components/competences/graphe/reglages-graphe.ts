/**
 * Réglages du panneau du graphe — filtres, axe de coloration, forces.
 *
 * Persistés en `localStorage`, isolés par compte (`cleParCompte`, même
 * convention que `lib/tutor/cle-client.ts` pour la configuration du tuteur —
 * CLAUDE.md : « toute clé de stockage navigateur doit être isolée par
 * compte »). C'est un confort d'affichage, jamais une donnée du domaine :
 * perdre ces réglages (quota, navigation privée) ne coûte rien de plus
 * qu'un panneau à reconfigurer.
 */

"use client";

import { cleParCompte } from "@/lib/ui/stockage-session";
import type { TypeLien, TypeNoeud } from "@/lib/domain/graphe";

export type AxeCouleur = "domaine" | "palier" | "maitrise" | "couverture";

export interface ReglagesGraphe {
  typesNoeudsVisibles: Record<TypeNoeud, boolean>;
  typesLiensVisibles: Record<TypeLien, boolean>;
  axeCouleur: AxeCouleur;
  /** Seuil sous lequel une arête `similarite` n'est pas affichée. */
  seuilSimilarite: number;
  forces: {
    /** Répulsion entre nœuds — intensité de `forceManyBody`. */
    repulsion: number;
    /** Distance de repos des liens — `forceLink().distance()`. */
    distanceLiens: number;
    /** Force de rappel vers le centre — `forceX/forceY().strength()`. */
    centrage: number;
  };
  /** Zoom à partir duquel les libellés apparaissent. */
  seuilLibelles: number;
}

export const REGLAGES_PAR_DEFAUT: ReglagesGraphe = {
  typesNoeudsVisibles: { competence: true, exercice: false, theme: true, document: true },
  typesLiensVisibles: { prerequis: true, theme: true, exercice: true, similarite: true, document: true },
  axeCouleur: "domaine",
  seuilSimilarite: 0.15,
  forces: { repulsion: 220, distanceLiens: 70, centrage: 0.03 },
  seuilLibelles: 0.6,
};

function cle(compteId: string): string {
  return cleParCompte("graphe-reglages", compteId);
}

/**
 * Fusion superficielle sur chaque section : un ancien réglage stocké avant
 * l'ajout d'un champ ne doit pas faire planter la lecture, il doit se
 * compléter avec les valeurs par défaut du champ manquant.
 */
export function lireReglagesGraphe(compteId: string): ReglagesGraphe {
  try {
    const brut = window.localStorage.getItem(cle(compteId));
    if (!brut) return REGLAGES_PAR_DEFAUT;
    const partiel = JSON.parse(brut) as Partial<ReglagesGraphe>;
    return {
      ...REGLAGES_PAR_DEFAUT,
      ...partiel,
      typesNoeudsVisibles: {
        ...REGLAGES_PAR_DEFAUT.typesNoeudsVisibles,
        ...partiel.typesNoeudsVisibles,
      },
      typesLiensVisibles: {
        ...REGLAGES_PAR_DEFAUT.typesLiensVisibles,
        ...partiel.typesLiensVisibles,
      },
      forces: { ...REGLAGES_PAR_DEFAUT.forces, ...partiel.forces },
    };
  } catch {
    return REGLAGES_PAR_DEFAUT;
  }
}

export function ecrireReglagesGraphe(compteId: string, reglages: ReglagesGraphe): void {
  try {
    window.localStorage.setItem(cle(compteId), JSON.stringify(reglages));
  } catch {
    /* quota atteint ou navigation privée — un réglage non retenu n'est pas une perte de donnée */
  }
}
