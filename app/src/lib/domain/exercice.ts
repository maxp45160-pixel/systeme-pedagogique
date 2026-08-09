/**
 * Cycle de vie d'un exercice — module pur, testable sans base.
 *
 * `Exercise` n'a longtemps porté aucun statut : un exercice réussi disparaissait
 * de la recommandation mais restait dans la liste, et rien ne permettait de
 * retirer un exercice manifestement hors niveau. La bibliothèque ne faisait
 * qu'enfler.
 *
 * La règle retenue est le **calque exact** de celle du référentiel (ADR-027),
 * jusqu'au nom du type : ce qui ne porte aucune trace s'efface, ce qui en porte
 * s'archive. D'où l'import de `ModeRetrait` depuis `referentiel-compte` plutôt
 * qu'un jumeau local — deux vocabulaires pour une même règle finiraient par
 * diverger.
 */

import type { ModeRetrait } from "./referentiel-compte";
import type { Exercise, ExerciseAttempt } from "./types";

export type { ModeRetrait };

/* ------------------------------------------------------------------ */
/* Bornes des deux nombres dont le moteur se sert comme d'une règle     */
/* ------------------------------------------------------------------ */

/**
 * Bornes de `dureeEstimeeMin` et de `difficulte` — une seule autorité.
 *
 * Ces deux valeurs ne sont pas des métadonnées d'affichage. La difficulté est
 * le point de départ de `difficulteConseillee` ; la durée est ce à quoi
 * `tentativeMenee` compare une tentative pour décider si une preuve s'écrit.
 * Elles étaient bornées à trois endroits qui ne se parlaient pas — le schéma
 * de l'outil du tuteur, la conversion, et nulle part à l'écriture. La borne
 * haute de la conversion (480) était le double de celle du schéma (240) : ce
 * qui entrait en base pouvait dépasser ce que le tuteur avait le droit de
 * proposer.
 *
 * Les vivre ici, dans un module pur que les trois importent, est la même
 * discipline que `scinderRetraits` (ADR-044) : deux copies d'une règle
 * finissent par diverger, et la divergence est invisible.
 */
export const DUREE_ESTIMEE_MIN = 5;
export const DUREE_ESTIMEE_MAX = 240;
export const DIFFICULTE_MIN = 1;
export const DIFFICULTE_MAX = 5;

/**
 * Quel retrait s'applique à un exercice, **dérivé** du nombre de tentatives.
 *
 * Ce n'est pas un choix offert à l'utilisateur. Une tentative a produit des
 * preuves, et une preuve ne disparaît pas (P4, anti-hallucination §6) : dès la
 * première, seul l'archivage reste. Sans aucune tentative, l'exercice n'a rien
 * produit et s'efface franchement.
 */
export function modeRetraitExercice(nombreDeTentatives: number): ModeRetrait {
  return nombreDeTentatives === 0 ? "suppression" : "archivage";
}

/**
 * Toutes les tentatives portant sur un exercice, quel que soit leur statut.
 *
 * Les abandons comptent ici, contrairement à ce que fait la calibration. La
 * question n'est pas « qu'a-t-on mesuré ? » mais « reste-t-il une trace ? » :
 * une tentative abandonnée figure au journal et cite l'exercice par son titre.
 * L'effacer laisserait une entrée qui ne résout plus.
 */
export function compterTentatives(
  exerciceId: string,
  tentatives: ExerciseAttempt[],
): number {
  return tentatives.filter((t) => t.exerciseId === exerciceId).length;
}

/**
 * Un exercice de diagnostic est livré avec le logiciel : il n'appartient pas au
 * compte et ne se retire pas ligne à ligne. Le retirer du flux passe par le
 * périmètre de la compétence (`competences.active`), pas par l'exercice.
 */
export function estRetirable(exercice: Exercise): boolean {
  return exercice.origine !== "seed" && !exercice.diagnostic;
}

/**
 * Statut d'usage d'un exercice, dérivé de ses tentatives — jamais stocké (P1).
 *
 * `acquis` n'est pas « maîtrisé » : c'est « au moins une tentative réussie ».
 * La maîtrise est une propriété de la compétence, dérivée des preuves par
 * `skill-state.ts`, pas une étiquette posée sur un exercice.
 */
export type UsageExercice = "a-faire" | "en-cours" | "acquis" | "travaille";

export function usageExercice(
  exerciceId: string,
  tentatives: ExerciseAttempt[],
): UsageExercice {
  const siennes = tentatives.filter((t) => t.exerciseId === exerciceId);
  if (siennes.some((t) => t.statut === "en-cours")) return "en-cours";
  const terminees = siennes.filter((t) => t.statut === "terminee");
  if (terminees.some((t) => t.resultat === "reussi")) return "acquis";
  if (terminees.length > 0) return "travaille";
  return "a-faire";
}
