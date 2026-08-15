/**
 * Fonctions de filtrage et de tri des domaines pour l'Atelier.
 *
 * Module pur (Couche 3 - Décide) : calcule et dérive l'ordre et le filtrage des
 * domaines affichés sans altérer les sources de vérité ni stocker d'état.
 */

import type { VueDomaineAtelier } from "./vue-atelier";

export type TriDomaine =
  | "recent"
  | "couverture-desc"
  | "couverture-asc"
  | "alpha-asc"
  | "alpha-desc"
  | "ordre"
  | "competences-desc";

export type FiltreStatutDomaine = "tous" | "en-cours" | "non-demarre" | "complete";

export interface OptionsFiltrageDomaines {
  recherche?: string;
  statut?: FiltreStatutDomaine;
  tri?: TriDomaine;
}

export const LIBELLES_TRIS_DOMAINES: Record<TriDomaine, string> = {
  recent: "Dernière activité",
  "couverture-desc": "Couverture (décroissante)",
  "couverture-asc": "Couverture (croissante)",
  "alpha-asc": "Alphabétique (A à Z)",
  "alpha-desc": "Alphabétique (Z à A)",
  "competences-desc": "Nombre de compétences",
  ordre: "Ordre du référentiel",
};

export const OPTIONS_STATUTS_DOMAINES: Array<{ cle: FiltreStatutDomaine; libelle: string }> = [
  { cle: "tous", libelle: "Tous" },
  { cle: "en-cours", libelle: "En cours" },
  { cle: "non-demarre", libelle: "Non démarrés" },
  { cle: "complete", libelle: "Complétés" },
];

/** Calcule le ratio de couverture d'un domaine dans [0, 1]. */
export function calculerRatioCouverture(domaine: VueDomaineAtelier): number {
  const total = domaine.competences.length;
  if (total === 0) return 0;
  return domaine.nombreEvaluees / total;
}

/**
 * Filtre et trie une liste de domaines d'atelier selon les critères fournis.
 */
export function filtrerEtTrierDomaines(
  domaines: VueDomaineAtelier[],
  options: OptionsFiltrageDomaines,
): VueDomaineAtelier[] {
  const { recherche = "", statut = "tous", tri = "recent" } = options;
  const terme = recherche.trim().toLocaleLowerCase("fr-FR");

  return domaines
    .filter((domaine) => {
      // 1. Filtrage textuel (nom, description, préfixe)
      if (terme) {
        const nomNormalise = domaine.nom.toLocaleLowerCase("fr-FR");
        const descNormalise = (domaine.description ?? "").toLocaleLowerCase("fr-FR");
        const prefixeNormalise = (domaine.domaine.prefixe ?? "").toLocaleLowerCase("fr-FR");
        const correspond =
          nomNormalise.includes(terme) ||
          descNormalise.includes(terme) ||
          prefixeNormalise.includes(terme);
        if (!correspond) return false;
      }

      // 2. Filtrage par statut de progression
      const total = domaine.competences.length;
      const evaluees = domaine.nombreEvaluees;
      if (statut === "en-cours") {
        return evaluees > 0 && evaluees < total;
      }
      if (statut === "non-demarre") {
        return evaluees === 0;
      }
      if (statut === "complete") {
        return total > 0 && evaluees === total;
      }
      return true;
    })
    .sort((a, b) => {
      if (tri === "recent") {
        if (a.derniereActivite && b.derniereActivite) {
          const diff = b.derniereActivite.localeCompare(a.derniereActivite);
          if (diff !== 0) return diff;
        } else if (a.derniereActivite && !b.derniereActivite) {
          return -1;
        } else if (!a.derniereActivite && b.derniereActivite) {
          return 1;
        }
        return a.nom.localeCompare(b.nom, "fr-FR");
      }

      if (tri === "couverture-desc") {
        const ratioA = calculerRatioCouverture(a);
        const ratioB = calculerRatioCouverture(b);
        if (ratioB !== ratioA) return ratioB - ratioA;
        return a.nom.localeCompare(b.nom, "fr-FR");
      }

      if (tri === "couverture-asc") {
        const ratioA = calculerRatioCouverture(a);
        const ratioB = calculerRatioCouverture(b);
        if (ratioA !== ratioB) return ratioA - ratioB;
        return a.nom.localeCompare(b.nom, "fr-FR");
      }

      if (tri === "alpha-asc") {
        return a.nom.localeCompare(b.nom, "fr-FR");
      }

      if (tri === "alpha-desc") {
        return b.nom.localeCompare(a.nom, "fr-FR");
      }

      if (tri === "competences-desc") {
        const diff = b.competences.length - a.competences.length;
        if (diff !== 0) return diff;
        return a.nom.localeCompare(b.nom, "fr-FR");
      }

      if (tri === "ordre") {
        const ordreA = a.domaine.ordre ?? 0;
        const ordreB = b.domaine.ordre ?? 0;
        if (ordreA !== ordreB) return ordreA - ordreB;
        return a.nom.localeCompare(b.nom, "fr-FR");
      }

      return 0;
    });
}
