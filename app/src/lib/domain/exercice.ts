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
 * Combien d'énoncés complets on demande au tuteur en un tour.
 *
 * Observation, pas préférence : six énoncés — énoncé, indices, correction,
 * critères — tiennent dans une réponse ; seize se font couper en chemin. La
 * valeur vivait en constante locale de la liste d'exercices, où elle bornait la
 * génération par domaine. La composition d'une séance bute sur exactement la
 * même limite, et pour la même raison : deux copies auraient divergé au premier
 * changement de modèle, sans que rien ne le signale.
 */
export const EXERCICES_PAR_LOT_MAX = 6;

/** Ce qu'un exercice doit satisfaire pour entrer en base, création ou édition. */
export interface ContenuExercice {
  titre: string;
  difficulte: number;
  dureeEstimeeMin: number;
  competences: string[];
  enonce: string;
  correction: string;
  criteres: unknown[];
}

/**
 * Les refus d'un contenu d'exercice, en un point d'autorité (ADR-047).
 *
 * `creerExercice` portait ces règles en ligne. `modifierExercice` allait devoir
 * les reprendre : deux copies d'une même validation, et la seconde aurait pu
 * être plus permissive sans que rien ne le signale — on aurait pu faire entrer
 * par l'édition ce que la création refuse. C'est la forme exacte du défaut
 * qu'ADR-044 a corrigé pour les retraits, et §2.8 pour `basculerActives`.
 *
 * Module pur : testable sans base, et la validation appliquée est exactement
 * celle que les tests vérifient.
 */
export function motifRefusExercice(contenu: ContenuExercice): string | null {
  if (!contenu.titre.trim()) return "Le titre est obligatoire.";
  if (!contenu.enonce.trim()) return "L'énoncé est obligatoire.";
  if (!contenu.correction.trim()) return "La correction est obligatoire.";
  if (contenu.competences.length === 0) return "Au moins une compétence est requise.";
  if (contenu.criteres.length === 0) return "Au moins un critère est requis.";

  /*
   * Difficulté et durée ne sont pas des métadonnées d'affichage : ce sont les
   * unités de mesure du moteur. La difficulté est le point de départ de
   * `difficulteConseillee` ; la durée est ce à quoi `tentativeMenee` compare
   * une tentative pour décider si une preuve s'écrit. Les bornes sont celles du
   * schéma de l'outil du tuteur — ce qui entre en base doit être ce qu'il avait
   * le droit de proposer.
   */
  if (
    !Number.isInteger(contenu.difficulte) ||
    contenu.difficulte < DIFFICULTE_MIN ||
    contenu.difficulte > DIFFICULTE_MAX
  ) {
    return `Difficulté hors bornes : ${contenu.difficulte}. Elle doit être un entier de ${DIFFICULTE_MIN} à ${DIFFICULTE_MAX}.`;
  }
  if (
    !Number.isInteger(contenu.dureeEstimeeMin) ||
    contenu.dureeEstimeeMin < DUREE_ESTIMEE_MIN ||
    contenu.dureeEstimeeMin > DUREE_ESTIMEE_MAX
  ) {
    return `Durée estimée hors bornes : ${contenu.dureeEstimeeMin}. Elle doit être un entier de ${DUREE_ESTIMEE_MIN} à ${DUREE_ESTIMEE_MAX} minutes.`;
  }

  return null;
}

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
