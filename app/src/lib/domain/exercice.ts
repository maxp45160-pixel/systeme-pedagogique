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
