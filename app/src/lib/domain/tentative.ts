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
import { DUREE_ESTIMEE_MAX } from "@/lib/domain/exercice";

/**
 * La durée d'une tentative que le système accepte de compter comme du temps
 * travaillé (ADR-071).
 *
 * `terminerExercice` et `abandonnerExercice` écrivent `dureeMin` comme du temps
 * d'HORLOGE : début de la tentative, fin du geste de clôture. Observé le
 * 15/08/2026 sur `att-mst5fis8-rfsu6` — exercice ouvert le 14 à 18 h 15, abandonné
 * le 15 à 11 h 11, `duree_min = 1015`, `statut = abandonnee`. L'accueil affichait
 * « TRAVAILLÉ 16 h 55 · EXERCICES 0 · PREUVES 0 » et la carte annuelle peignait
 * une journée entière de travail qui n'a pas eu lieu.
 *
 * Deux plafonds, parce que la question n'est pas la même des deux côtés :
 *
 * - **tentative abandonnée** → `dureeEstimeeMin`. Elle ne produit aucune preuve
 *   (ADR-030) ; le temps qu'on lui retient ne peut pas dépasser ce que
 *   l'exercice était censé demander. On ne l'efface pas pour autant : un abandon
 *   après 5 minutes reste 5 minutes travaillées, et le jour reste actif.
 * - **tentative menée** → `DUREE_ESTIMEE_MAX` (240 min), la borne haute déjà en
 *   vigueur pour `dureeEstimeeMin`. Rien dans les données ne justifie de rogner
 *   une durée plausible — `diag-ro-01` a légitimement pris 61 min sur 35
 *   estimées, et `dureeDeReference` a besoin de ce fait intact (ADR-045). Ce
 *   plafond-là n'est qu'un garde-fou contre l'onglet laissé ouvert la nuit.
 *
 * Sans durée exploitable, on renvoie `undefined` : l'absence de mesure n'est pas
 * un zéro (P2), et ce n'est pas ici qu'on fabriquera une valeur.
 */
export function dureeRetenue(
  tentative: Pick<ExerciseAttempt, "statut" | "dureeMin">,
  /**
   * `dureeEstimeeMin` de l'exercice porté par la tentative, s'il est résolvable.
   *
   * L'estimation seule, pas l'exercice : l'appelant qui n'a pas l'entité — c'est
   * le cas de l'activité, qui travaille sur une table de durées — n'a pas à en
   * fabriquer une pour poser la question.
   */
  estimee?: number,
): number | undefined {
  const reelle = tentative.dureeMin;
  if (typeof reelle !== "number" || !Number.isFinite(reelle) || reelle <= 0) return undefined;

  // Estimation inconnue : on ne peut pas appliquer le plafond serré. Le garde-fou
  // général s'applique quand même — il vaut mieux 240 min qu'une nuit entière.
  const plafond =
    tentative.statut === "abandonnee" && typeof estimee === "number" && estimee > 0
      ? estimee
      : DUREE_ESTIMEE_MAX;

  return Math.min(reelle, plafond);
}

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

/**
 * Ce qu'un appel à `abandonnerExercice` doit faire de la tentative visée.
 *
 * `terminerExercice` refusait déjà une tentative close ; l'abandon, lui, ne
 * regardait rien. Mesuré le 12/08/2026 sur `diag-dev-02` : **douze séances
 * identiques** écrites entre 20:08:17 et 20:08:29 pour une seule tentative
 * (`att-msnh82t2-l8ls6`), toutes `genereAutomatiquement`, toutes comptées par
 * `calculerActivite` (lib/engine/historique.ts) — un abandon compté douze fois
 * dans le temps travaillé (ADR-048 : une séance, une entrée de journal).
 *
 * Le refus symétrique de `motifRefusTerminerExercice` serait ici le mauvais
 * geste : le second clic vient d'un utilisateur qui a déjà obtenu ce qu'il
 * demandait, lui montrer une erreur serait mentir sur l'état réel. D'où trois
 * issues plutôt que deux :
 *
 * - `abandonner` — la tentative est `en-cours`, on clôt et on journalise ;
 * - `ignorer` — elle est **déjà** `abandonnee` : rien à écrire, on navigue.
 *   C'est ce cas qui rend la fonction idempotente ;
 * - `refuser` — incohérence réelle : tentative déjà `terminee` (elle porte une
 *   preuve, l'abandonner la contredirait) ou couple tentative/exercice faux.
 */
export type DecisionAbandonExercice =
  | { action: "abandonner" }
  | { action: "ignorer" }
  | { action: "refuser"; motif: string };

export function deciderAbandonExercice(
  avant: Pick<ExerciseAttempt, "id" | "statut" | "exerciseId">,
  exerciseId: string,
): DecisionAbandonExercice {
  // Le couple d'abord : une tentative désignée par erreur ne doit être ni
  // clôturée ni silencieusement acceptée, quel que soit son statut.
  if (avant.exerciseId !== exerciseId) {
    return {
      action: "refuser",
      motif: "La tentative ne correspond pas à cet exercice : l'abandon est rejeté.",
    };
  }
  // Déjà abandonnée : le résultat demandé est déjà en base. Aucune écriture.
  if (avant.statut === "abandonnee") return { action: "ignorer" };
  // Terminée : elle porte une évaluation, donc potentiellement une preuve.
  // L'abandon ne défait pas une mesure (P4).
  if (avant.statut === "terminee") {
    return {
      action: "refuser",
      motif: "Cette tentative est déjà terminée : elle ne peut plus être abandonnée.",
    };
  }
  return { action: "abandonner" };
}
