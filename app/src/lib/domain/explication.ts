/**
 * Auto-explication conceptuelle — palier Niveau 0 -> Niveau 1 (Compréhension).
 *
 * L'apprenant reformule le concept avec ses propres mots (méthode Feynman / auto-explication).
 * La réussite de cette étape démontre la compréhension minimale requise pour aborder
 * les exercices d'application guidés.
 */

export const EXPLICATION_MIN_CARACTERES = 30;
export const EXPLICATION_MAX_CARACTERES = 8_000;

export type ResultatExplication = "reussi" | "partiel" | "echec";

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

export interface DemandeEvaluationExplication {
  skillCode: string;
  texteExplication: string;
}

/** Vérifie si le texte soumis possède une longueur suffisante pour être évalué. */
export function explicationSuffisante(texte: string | null | undefined): boolean {
  if (!texte) return false;
  const nettoye = texte.trim();
  return nettoye.length >= EXPLICATION_MIN_CARACTERES;
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
