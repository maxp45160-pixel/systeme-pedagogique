/**
 * Auto-explication conceptuelle — palier Niveau 0 -> Niveau 1 (Compréhension).
 *
 * L'apprenant reformule le concept avec ses propres mots (méthode Feynman / auto-explication).
 * La réussite de cette étape démontre la compréhension minimale requise pour aborder
 * les exercices d'application guidés.
 */

import type { ResultatTentative } from "./types";

/**
 * Le barème de l'auto-explication — transcription du protocole d'évaluation
 * §10.1, qui fait foi.
 *
 * ## Pourquoi il vit ici et non dans le prompt
 *
 * Ces quatre critères et ce seuil décident d'un `resultat` et de deux scores de
 * dimension qui entrent au journal comme n'importe quelle Observation
 * (`enregistrerExplication` écrit une `ExerciseAttempt` complète). C'est donc
 * une **règle de mesure**, et `INSTRUCTIONS §3` dit que les protocoles font foi
 * sur ce point.
 *
 * Ils vivaient pourtant en dur dans `lib/tutor/explication.ts`, hors de tout
 * protocole — relevé le 24/08/2026. La route d'évaluation ne charge pas
 * `00_instructions/` (son prompt est délibérément court, sans référentiel ni
 * historique), donc le protocole ne peut pas s'y injecter : le code le
 * **transcrit**, comme `atomicite.ts` transcrit §2 du protocole de référentiel.
 * Toute modification se fait des deux côtés, et le protocole décide.
 */

/** Le seuil de « réussi » sur la dimension compréhension — protocole §10.1. */
export const SEUIL_REUSSITE_COMPREHENSION = 0.6;

/**
 * Les quatre critères de l'auto-explication, dans l'ordre du protocole.
 *
 * Une seule déclaration : le prompt les rend, l'écran peut les afficher, et
 * une cinquième ligne ajoutée ici arrive aux deux sans être recopiée.
 */
export const CRITERES_AUTO_EXPLICATION: readonly string[] = [
  "Définition essentielle : le concept fondamental est-il compris et formulé simplement, sans paraphrase vide ?",
  "Utilité et raison d'être : la personne explique-t-elle pourquoi ce concept existe ou à quoi il sert ?",
  "Concrétude / exemple : l'explication s'appuie-t-elle sur une illustration concrète, un exemple ou une intuition claire ?",
  "Précision / absence de contre-sens : l'explication évite-t-elle les confusions majeures et les pièges classiques ?",
];

/** L'attribution du résultat — protocole §10.1, mot pour mot. */
export const ATTRIBUTION_RESULTAT_EXPLICATION: readonly string[] = [
  `'reussi' : l'essentiel du concept est compris et articulé clairement (scoreComprehension >= ${SEUIL_REUSSITE_COMPREHENSION}).`,
  "'partiel' : l'intuition est présente mais l'explication manque de rigueur, d'exemples, ou contient des lacunes notables.",
  "'echec' : l'explication contient un contre-sens majeur, est hors sujet, ou reste trop superficielle.",
];

export const EXPLICATION_MIN_CARACTERES = 30;
export const EXPLICATION_MAX_CARACTERES = 8_000;

export type ResultatExplication = ResultatTentative;

export interface EvaluationExplication {
  resultat: ResultatExplication;
  /** Score de la dimension « compréhension » dans [0, 1]. */
  scoreComprehension: number;
  /** Score de la dimension « justification » dans [0, 1]. */
  scoreJustification: number;
  /** Éléments clés du concept bien identifiés et expliqués. */
  pointsCles: string[];
  /** Éléments importants omis, approximatifs ou contenant des contre-sens. */
  pointsManquants: string[];
  /** Commentaire bienveillant et constructif pour perfectionner la maîtrise. */
  feedbackFormatif: string;
  /** Conseil pour la suite (ex: passer aux exercices guidés ou reformuler). */
  conseilSuivant: string;
}

/** Valide les bornes autorisées d'une explication. */
export function verifierTexteExplication(texte: string): { valide: boolean; erreur?: string } {
  const nettoye = texte.trim();
  if (nettoye.length < EXPLICATION_MIN_CARACTERES) {
    return {
      valide: false,
      erreur: `Votre explication est trop courte (au moins ${EXPLICATION_MIN_CARACTERES} caractères requis pour évaluer la compréhension).`,
    };
  }
  if (nettoye.length > EXPLICATION_MAX_CARACTERES) {
    return {
      valide: false,
      erreur: `Votre explication dépasse la limite de ${EXPLICATION_MAX_CARACTERES} caractères. Résumez l'essentiel du concept.`,
    };
  }
  return { valide: true };
}
