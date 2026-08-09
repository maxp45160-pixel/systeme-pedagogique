/**
 * Ce qu'une tentative doit porter pour qu'on puisse en conclure quelque chose.
 *
 * Module pur, testable sans base — et c'est le point : la règle vivait
 * jusqu'ici nulle part, donc partout. Le bilan s'ouvrait sur une tentative
 * vide, l'utilisateur cochait ses critères de mémoire, et la preuve écrite
 * ne s'appuyait sur aucune trace relisible.
 *
 * Mesuré le 07/08/2026 : **16 des 37 tentatives terminées ne portent aucune
 * réponse écrite**. Ce n'est donc pas une formalité qu'on ajoute, c'est un
 * changement de parcours. Il a une contrepartie obligatoire, `abandonnerExercice`
 * (lib/store/actions.ts) : une tentative qu'on ne veut pas mener doit pouvoir se
 * clore sans réponse — elle n'écrit aucune preuve de toute façon.
 *
 * ⚠️ Aucun seuil de longueur n'est posé, et c'est délibéré (CLAUDE.md §8 : pas
 * de seuil sans données). Le jour où l'usage montre qu'on tape « . » pour
 * passer, ce sera une observation, et un seuil pourra être calé dessus — comme
 * `FRACTION_NON_TENTEE` l'a été sur des tentatives réelles (ADR-028).
 */

import type { ExerciseAttempt } from "@/lib/domain/types";

/**
 * La réponse écrite permet-elle d'ouvrir le bilan ?
 *
 * Non vide après `trim`, et rien d'autre. `undefined` et `null` sont traités
 * comme vides : `attempts.reponse` est déclarée `NOT NULL DEFAULT ''` en base,
 * mais une tentative venue d'un seed ou d'un test peut ne pas porter le champ,
 * et présumer « suffisante » une valeur absente serait exactement l'inverse de
 * la règle.
 */
export function reponseSuffisante(reponse: string | null | undefined): boolean {
  return typeof reponse === "string" && reponse.trim().length > 0;
}

/**
 * Pourquoi le bilan est fermé, ou `null` s'il est ouvert.
 *
 * Le message nomme **le bouton** à cliquer, pas l'intention : la zone de
 * réponse exige un « Enregistrer le brouillon » explicite (choix délibéré de
 * `zone-reponse.tsx`), donc du texte à l'écran ne suffit pas — c'est ce que la
 * base porte qui compte. Sans ce détail, le message enverrait l'utilisateur
 * regarder un champ qu'il a déjà rempli.
 */
export function motifBlocageBilan(reponse: string | null | undefined): string | null {
  if (reponseSuffisante(reponse)) return null;
  return "Le bilan demande ta réponse écrite. Rédige-la puis clique « Enregistrer le brouillon » : c'est la trace du raisonnement, et c'est elle que le tuteur relira pour te proposer une correction.";
}

export interface SoumissionTerminerExercice {
  exerciseId: string;
  dureeMin: number;
}

/**
 * Les refus d'une soumission de bilan, en un point d'autorité (audit §2.1).
 *
 * `terminerExercice` (lib/store/actions.ts) est une Server Function, donc un
 * point d'entrée public : rejouer une soumission pouvait écrire une seconde
 * preuve pour la même tentative, et un couple tentative/exercice incohérent
 * attribuait la preuve aux compétences du mauvais exercice. `dureeMin`, qui
 * alimente `tentativeMenee`, n'était pas validé non plus.
 *
 * Le vivre ici — module pur, testable sans base, partagé avec l'écriture —
 * garantit que la validation effectivement appliquée est exactement celle que
 * les tests vérifient (règle « une règle, une autorité »).
 */
export function motifRefusTerminerExercice(
  avant: Pick<ExerciseAttempt, "id" | "statut" | "exerciseId" | "reponse">,
  soumission: SoumissionTerminerExercice,
): string | null {
  // Une tentative close ne se rejoue pas : sinon la soumission réécrirait une
  // seconde preuve pour la même tentative.
  if (avant.statut !== "en-cours") {
    return "Cette tentative est déjà clôturée : elle ne peut être soumise qu'une fois.";
  }
  // Le couple doit concorder : la preuve est attribuée aux compétences de
  // l'exercice porté par la tentative.
  if (avant.exerciseId !== soumission.exerciseId) {
    return "La tentative ne correspond pas à cet exercice : la soumission est rejetée.";
  }
  // La durée est l'unité de mesure de `tentativeMenee` : une valeur non fiable
  // ferait dire au moteur le contraire de ce qui s'est passé. Refuser plutôt
  // que rabattre sur un défaut (P2).
  if (!Number.isFinite(soumission.dureeMin) || soumission.dureeMin <= 0) {
    return "La durée renseignée est invalide : elle doit être un nombre strictement positif.";
  }
  // La réponse écrite reste la condition d'ouverture du bilan, donc d'écriture
  // de la preuve — l'interface peut être contournée, pas la règle.
  if (!reponseSuffisante(avant.reponse)) {
    return motifBlocageBilan(avant.reponse);
  }
  return null;
}
