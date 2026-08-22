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
 *   * un domaine hors périmètre (`statistiques`, STAT-01), pour vérifier
 *     qu'une observation hors périmètre n'entre dans aucun agrégat.
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
  }),
];

/**
 * Le tag que la migration d'ADR-107 pose pour chaque compétence existante :
 * son domaine de création devient un tag explicite.
 *
 * Les fixtures reproduisent cet état, faute de quoi tout le référentiel de test
 * partirait « À classer » — ce qui serait un compte fraîchement détagué, pas un
 * compte migré.
 */
function tagsDuDomaineDeCreation(skills: Skill[]): Array<{ code: string; domaine: string }> {
  return skills.map((skill) => ({ code: skill.code, domaine: skill.domaine }));
}

export const REFERENTIEL_TEST: Referentiel = assemblerReferentiel(
  DOMAINES_TEST,
  SKILLS_TEST,
  tagsDuDomaineDeCreation(SKILLS_TEST),
);
export const REFERENTIEL_VIDE: Referentiel = assemblerReferentiel([], []);

/**
 * Construit un référentiel de test sur mesure, pour les cas particuliers.
 *
 * `tags` traverse jusqu'à `assemblerReferentiel` : c'est la seule voie d'entrée
 * des tags de domaine (ADR-107), qui sont recalculés là et écrasent ce qu'une
 * `Skill` littérale prétendrait porter. Sans liste explicite, chaque compétence
 * reçoit le tag de son domaine de création — l'état d'après migration.
 */
export function referentielDe(
  skills: Skill[],
  domaines: Domaine[] = DOMAINES_TEST,
  tags: Array<{ code: string; domaine: string }> = tagsDuDomaineDeCreation(skills),
): Referentiel {
  return assemblerReferentiel(domaines, skills, tags);
}

export { skill as skillDeTest, domaine as domaineDeTest };
