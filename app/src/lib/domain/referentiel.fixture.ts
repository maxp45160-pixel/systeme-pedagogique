/**
 * Référentiel de test — **importé uniquement par les fichiers `*.test.ts`**.
 *
 * Depuis ADR-026 le référentiel est une donnée par compte : il n'existe plus de
 * module que les tests puissent importer pour se donner des compétences. Les
 * faire dépendre d'un référentiel réel serait de toute façon un défaut — un test
 * du moteur casserait à chaque fois qu'un utilisateur ajoute une branche.
 *
 * Ce jeu reproduit la forme dont les tests ont besoin, et rien de plus :
 *   * un domaine actif (`developpement`, DEV-01 → DEV-06) couvrant les trois
 *     paliers, avec des prérequis et des importances distinctes ;
 *   * un domaine hors périmètre (`statistiques`, STAT-01) portant une
 *     `hypotheseInitiale`, pour vérifier qu'une hypothèse ne devient jamais un
 *     niveau et qu'une preuve hors périmètre n'entre dans aucun agrégat.
 *
 * Les valeurs d'`importance`, de `palier` et de `prerequis` reprennent celles du
 * référentiel historique migré : les assertions numériques gardent le même sens
 * qu'avant le chantier.
 */

import { assemblerReferentiel } from "./referentiel-compte";
import type { Domaine, Referentiel, Skill } from "./types";

const domaine = (
  id: string,
  nom: string,
  prefixe: string,
  ordre: number,
): Domaine => ({ id, nom, prefixe, description: "", ordre, version: 1, archive: false, origine: "migration" });

const skill = (
  code: string,
  domaineId: string,
  palier: Skill["palier"],
  importance: number,
  ordre: number,
  prerequis: string[] = [],
  extra: Partial<Skill> = {},
): Skill => ({
  code,
  domaine: domaineId,
  intitule: `Intitulé de ${code}`,
  palier,
  prerequis,
  importance,
  ordre,
  active: true,
  archive: false,
  origine: "migration",
  ...extra,
});

export const DOMAINES_TEST: Domaine[] = [
  domaine("developpement", "Développement logiciel", "DEV", 0),
  domaine("statistiques", "Statistiques et probabilités", "STAT", 1),
];

export const SKILLS_TEST: Skill[] = [
  skill("DEV-01", "developpement", "fondamentaux", 1, 0),
  skill("DEV-02", "developpement", "fondamentaux", 1, 1),
  skill("DEV-03", "developpement", "fondamentaux", 1, 2, ["DEV-02"]),
  skill("DEV-04", "developpement", "intermediaire", 0.9, 3, ["DEV-01", "DEV-03"]),
  skill("DEV-05", "developpement", "intermediaire", 0.9, 4, ["DEV-04"]),
  skill("DEV-06", "developpement", "intermediaire", 0.9, 5, ["DEV-01"]),
  // Hors périmètre : présente au référentiel, absente des calculs.
  skill("STAT-01", "statistiques", "fondamentaux", 1, 0, [], {
    active: false,
    hypotheseInitiale: {
      niveauSuppose: "0-1",
      justification: "Domaine couvert par la formation — hypothèse de niveau D, à confirmer.",
    },
  }),
];

export const REFERENTIEL_TEST: Referentiel = assemblerReferentiel(DOMAINES_TEST, SKILLS_TEST);
export const REFERENTIEL_VIDE: Referentiel = assemblerReferentiel([], []);

/** Construit un référentiel de test sur mesure, pour les cas particuliers. */
export function referentielDe(skills: Skill[], domaines: Domaine[] = DOMAINES_TEST): Referentiel {
  return assemblerReferentiel(domaines, skills);
}

export { skill as skillDeTest, domaine as domaineDeTest };
