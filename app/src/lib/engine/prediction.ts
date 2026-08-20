/**
 * Ce que le moteur affirme, écrit noir sur blanc — ADR-084.
 *
 * ## Le manque
 *
 * Le moteur affirme des choses tous les jours, et les jette :
 *
 *   « cet exercice te prendra 25 minutes »   `dureeDeReference()`
 *   « la difficulté 4 est la bonne pour toi » `difficulteVisee()`
 *   « au 3 septembre, tu sauras encore ça »   `prochaineRevision()`
 *
 * Aucune n'a jamais été confrontée au réel. Le moteur ne peut donc pas savoir
 * qu'il se trompe, et l'invariant de CLAUDE.md — « ne pas modifier les seuils
 * de calibration sans données justifiant le changement » — est indécidable
 * faute de données. Ce module construit ces données.
 *
 * ## Ce qui est écrit, et ce qui ne l'est pas
 *
 * Une prédiction n'est **pas dérivable après coup** : l'état qui l'a produite a
 * changé. C'est ce qui l'autorise à être stockée malgré P1, au même titre que
 * `BesoinDeclare` (ADR-050) et `verdictTuteur` (ADR-046).
 *
 * Sa **résolution**, elle, reste dérivée : aucune colonne de résultat, aucune
 * table d'issues. La tentative et l'observation qui tranchent existent déjà.
 *
 * ## Le modèle est assumé, pas appris
 *
 * Les trois fonctions ci-dessous sont des heuristiques **monotones et
 * explicites**, choisies pour être réfutables — pas pour être justes du premier
 * coup. Leurs constantes n'ont AUCUNE donnée derrière elles : c'est le contraire
 * de la méthode d'ADR-028, et c'est assumé, parce qu'il n'existe pas de donnée
 * avant d'avoir commencé à en produire. `MODELE_VERSION` est là pour que le
 * jour où on les corrige, les prédictions d'avant restent identifiables.
 *
 * ⚠️ Tant que `lib/engine/auto-evaluation.ts` n'a pas mesuré ces modèles, aucune
 * de ces valeurs ne doit être montrée à l'utilisateur comme une probabilité de
 * réussite. Ce sont des paris du moteur sur lui-même, pas des mesures sur la
 * personne (P3, et le §1 du protocole anti-hallucination).
 */

import type {
  Confiance,
  Difficulte,
  Exercise,
  ExerciseAttempt,
  SkillState,
} from "@/lib/domain/types";
import type { Facteur } from "./recommend";
import { dureeDeReference } from "./calibration";
import type { Calibration } from "./calibration";
import { prochaineRevision } from "./spaced";
import { cleJour } from "./dates";

/* ------------------------------------------------------------------ */
/* Versions                                                            */
/* ------------------------------------------------------------------ */

/**
 * La politique de décision — ce qui CHOISIT une action.
 *
 * À incrémenter dès qu'un poids de `recommend.ts` ou une règle d'arbitrage
 * change. Sans elle, deux décisions prises sous deux politiques différentes
 * seraient comparées comme si elles venaient du même système.
 */
export const POLITIQUE_VERSION = "recommandation-1";

/**
 * Le modèle de prédiction — ce qui AFFIRME quelque chose de vérifiable.
 *
 * Distinct de la politique : on peut changer l'ordre des recommandations sans
 * toucher à la façon dont on prédit une durée, et l'inverse.
 */
export const MODELE_VERSION = "prediction-1";

/* ------------------------------------------------------------------ */
/* Constantes du modèle v1 — aucune n'est mesurée, toutes sont bornées  */
/* ------------------------------------------------------------------ */

/**
 * Probabilité de réussite quand la difficulté visée tombe pile sur celle que
 * le niveau appelle.
 *
 * 0,6 et non 0,5 : un exercice « calibré » est censé être réussi plus souvent
 * qu'échoué, sans quoi la calibration ne calibrerait rien. C'est une hypothèse
 * sur l'intention du système, pas une observation.
 */
export const P_REUSSITE_CALIBRE = 0.6;

/** Ce qu'un cran de difficulté au-dessus de l'attendu retire à la réussite. */
export const PENTE_DIFFICULTE = 0.15;

/** Bornes : on n'affirme jamais la certitude, dans un sens ni dans l'autre. */
export const P_MIN = 0.05;
export const P_MAX = 0.95;

/**
 * Rétention : `P_RETENTION_BASE + AMPLITUDE × robustesse`.
 *
 * La base à 0,5 dit « je ne sais rien » pour une robustesse nulle ; l'amplitude
 * plafonne à 0,9 pour une robustesse parfaite. La robustesse est le proxy de
 * stabilité que le protocole d'évaluation §13 définit déjà, et sur lequel
 * `spaced.ts` calcule justement l'intervalle — prédire avec autre chose
 * reviendrait à contredire le modèle qu'on prétend vérifier.
 */
export const P_RETENTION_BASE = 0.5;
export const P_RETENTION_AMPLITUDE = 0.4;

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type TypeDecision =
  | "recommandation"
  | "composition-seance"
  | "revision-due"
  | "calibration";

export type TypePrediction = "reussite" | "duree" | "retention";

/**
 * L'empreinte de l'état au moment de décider.
 *
 * Pas l'état entier : ce qu'il faut pour relire la décision et comprendre ce
 * qu'elle voyait. Les observations elles-mêmes ne sont pas recopiées — elles sont
 * immuables et toujours là.
 */
export interface EmpreinteEtat {
  niveau: number | null;
  score: number | null;
  confiance: Confiance;
  robustesse: number | null;
  nombreObservations: number;
  /** Familles de situation distinctes (ADR-083), pas titres d'exercice. */
  contextes: number;
  joursDepuisDerniereObservation: number | null;
  difficulteVisee: Difficulte;
  /** D'où vient la difficulté visée — P3, et c'est ce qu'on veut mesurer. */
  sourceDifficulte: "calibration" | "niveau";
}

export interface DecisionMoteur {
  /** Clé d'idempotence : un rafraîchissement de page ne crée pas de ligne. */
  requestId: string;
  type: TypeDecision;
  politiqueVersion: string;
  cibleCode: string | null;
  cibleRef: string | null;
  facteurs: Facteur[];
  etatEntree: EmpreinteEtat;
}

export interface PredictionMoteur {
  requestId: string;
  type: TypePrediction;
  cibleCode: string;
  cibleRef: string | null;
  valeur: number;
  /** ISO. Renseigné pour `retention` seulement. */
  horizonLe: string | null;
  modeleVersion: string;
  /** Les valeurs lues qui ont produit la prédiction — P3. */
  entrees: Record<string, unknown>;
}

/** Ce qu'une présentation d'action produit : une décision et ses prédictions. */
export interface EmissionMoteur {
  decision: DecisionMoteur;
  predictions: PredictionMoteur[];
}

/* ------------------------------------------------------------------ */
/* Les trois modèles                                                   */
/* ------------------------------------------------------------------ */

function borner(p: number): number {
  return Math.min(P_MAX, Math.max(P_MIN, p));
}

/**
 * La difficulté qu'un niveau appelle — la table de `recommend.ts`, relue ici.
 *
 * Elle n'est pas importée : `difficulteDepuisNiveau` n'est pas exportée, et
 * l'exporter ferait de la table une dépendance partagée entre le classement et
 * la prédiction. Or c'est précisément l'écart entre les deux que ce module doit
 * pouvoir mesurer un jour : si la table change et que la prédiction la suit
 * mécaniquement, l'écart est nul par construction et on ne mesure rien.
 */
function difficulteAttendue(niveau: number | null): Difficulte {
  if (niveau === null || niveau <= 1) return 2;
  if (niveau === 2) return 3;
  if (niveau === 3) return 4;
  return 5;
}

/**
 * p(réussite) sur un exercice de difficulté donnée.
 *
 * `null` **quand aucune observation n'existe** : sans niveau dérivé, il n'y a rien
 * pour asseoir une probabilité, et en fabriquer une à 0,5 serait exactement ce
 * que P2 interdit — confondre « je ne sais pas » et « une chance sur deux ».
 * Un exercice de diagnostic sert à créer la première mesure, pas à être prédit.
 */
export function predireReussite(
  etat: SkillState,
  difficulte: Difficulte,
): { valeur: number; entrees: Record<string, unknown> } | null {
  if (etat.niveau === null) return null;

  const attendue = difficulteAttendue(etat.niveau);
  const ecart = difficulte - attendue;
  const valeur = borner(P_REUSSITE_CALIBRE - ecart * PENTE_DIFFICULTE);

  return {
    valeur,
    entrees: {
      niveau: etat.niveau,
      difficulteVisee: difficulte,
      difficulteAttendue: attendue,
      ecart,
      // Portée sans entrer dans le calcul : la confiance dit ce que vaut notre
      // connaissance, pas ce que vaut la personne. Elle servira à segmenter la
      // calibration (« le moteur est-il moins bon quand il sait moins ? »).
      confiance: etat.confiance,
      nombreObservations: etat.observations.length,
    },
  };
}

/**
 * La durée attendue sur un exercice, en minutes.
 *
 * La seule des trois qui s'appuie sur une mesure et non sur une hypothèse :
 * `dureeDeReference` prend la médiane observée dès deux tentatives menées, et
 * retombe sur l'estimation du tuteur sinon. C'est aussi la seule qui aura des
 * données dès le premier jour — **42 tentatives chronométrées** existent déjà.
 *
 * Et c'est là qu'on attend le premier résultat : ADR-045 a relevé que la durée
 * réelle valait en moyenne **0,48 fois** la durée estimée. Si la métrique ne
 * fait pas ressortir ce biais, c'est la métrique qui est fausse.
 */
export function predireDuree(
  exercice: Pick<Exercise, "id" | "dureeEstimeeMin">,
  tentatives: Pick<ExerciseAttempt, "exerciseId" | "statut" | "dureeMin">[],
): { valeur: number; entrees: Record<string, unknown> } {
  const reference = dureeDeReference(exercice, tentatives);
  return {
    valeur: reference.minutes,
    entrees: {
      source: reference.source,
      observations: reference.observations,
      dureeEstimeeMin: exercice.dureeEstimeeMin,
    },
  };
}

/**
 * p(le niveau tient jusqu'à la date due).
 *
 * L'affirmation rendue vérifiable est celle-ci : **la première observation
 * enregistrée après l'horizon n'est pas un échec**. C'est la promesse implicite
 * de la répétition espacée — si le moteur dit « pas avant 12 jours », il dit
 * qu'à 12 jours la compétence tient encore.
 *
 * `null` sans observation : `prochaineRevision` rend alors `sansObservation`, et une
 * compétence à diagnostiquer n'a pas de rétention à prédire.
 */
export function predireRetention(
  etat: SkillState,
  now: Date,
): { valeur: number; horizonLe: string; entrees: Record<string, unknown> } | null {
  const revision = prochaineRevision(etat, now);
  // `joursEcoules` est typé nullable : `sansObservation` le rend normalement
  // impossible ici, mais un modèle de révision substitué (l'interface
  // `ModeleRevision` le promet) pourrait le rendre nul autrement. Sans lui,
  // aucun horizon n'est calculable — et un horizon fabriqué rendrait la
  // prédiction irréfutable, donc inutile.
  if (revision.sansObservation || etat.robustesse === null || revision.joursEcoules === null) {
    return null;
  }

  const restant = revision.intervalleJours - revision.joursEcoules;
  const horizon = new Date(now.getTime() + Math.max(0, restant) * 86_400_000);

  return {
    valeur: borner(P_RETENTION_BASE + P_RETENTION_AMPLITUDE * etat.robustesse),
    horizonLe: horizon.toISOString(),
    entrees: {
      robustesse: etat.robustesse,
      intervalleJours: revision.intervalleJours,
      joursEcoules: revision.joursEcoules,
      niveau: etat.niveau,
      confiance: etat.confiance,
      dueALEmission: revision.due,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Émission                                                            */
/* ------------------------------------------------------------------ */

/**
 * La clé d'idempotence d'une décision : compte, jour, type, cible, politique.
 *
 * Le JOUR et non l'instant : sans cela, chaque rendu de la page écrirait une
 * ligne, et le journal mesurerait le nombre de rafraîchissements plutôt que le
 * nombre de décisions. Avec, un compte actif produit quelques lignes par jour.
 *
 * La politique entre dans la clé : si elle change en cours de journée, la
 * décision d'après est une décision différente, et doit s'écrire.
 *
 * ⚠️ `cleJour` découpe sur le fuseau du processus, pas sur UTC. C'est
 * délibéré — c'est le même « jour » que le cahier, la croissance du jour et le
 * décompte des jours actifs, et un journal qui découperait ailleurs
 * contredirait tout ce que la personne voit. Conséquence assumée : en
 * développement (Europe/Paris) la frontière tombe à 22 h UTC, en production
 * (Vercel, UTC) à minuit UTC. Au pire, une soirée à cheval produit deux
 * décisions au lieu d'une — un échantillon de plus, jamais une donnée fausse.
 */
export function cleDecision(
  now: Date,
  type: TypeDecision,
  cibleCode: string | null,
  politiqueVersion: string,
): string {
  return [cleJour(now), type, cibleCode ?? "-", politiqueVersion].join("|");
}

/**
 * Ce qu'une action présentée doit écrire.
 *
 * Appelé au moment où la carte « Prochaine action » est **servie**, pas quand
 * la personne clique : une recommandation ignorée est une information, et
 * n'écrire que les acceptées produirait un journal qui ne peut que donner
 * raison au moteur.
 */
export function emettre(options: {
  now: Date;
  etat: SkillState;
  difficulteVisee: Difficulte;
  calibration: Calibration | null;
  exercice: Pick<Exercise, "id" | "dureeEstimeeMin"> | null;
  facteurs: Facteur[];
  tentatives: Pick<ExerciseAttempt, "exerciseId" | "statut" | "dureeMin">[];
  type?: TypeDecision;
}): EmissionMoteur {
  const { now, etat, difficulteVisee, calibration, exercice, facteurs, tentatives } = options;
  const type = options.type ?? "recommandation";
  const cibleCode = etat.skill.code;

  const requestId = cleDecision(now, type, cibleCode, POLITIQUE_VERSION);

  const decision: DecisionMoteur = {
    requestId,
    type,
    politiqueVersion: POLITIQUE_VERSION,
    cibleCode,
    cibleRef: exercice?.id ?? null,
    facteurs,
    etatEntree: {
      niveau: etat.niveau,
      score: etat.score,
      confiance: etat.confiance,
      robustesse: etat.robustesse,
      nombreObservations: etat.observations.length,
      contextes: etat.contextesTestes.length,
      joursDepuisDerniereObservation: etat.joursDepuisDerniereObservation,
      difficulteVisee,
      sourceDifficulte: calibration?.difficulteConseillee != null ? "calibration" : "niveau",
    },
  };

  const predictions: PredictionMoteur[] = [];
  const pousser = (
    typePrediction: TypePrediction,
    valeur: number,
    entrees: Record<string, unknown>,
    cibleRef: string | null,
    horizonLe: string | null,
  ) => {
    predictions.push({
      requestId: `${requestId}|${typePrediction}`,
      type: typePrediction,
      cibleCode,
      cibleRef,
      valeur,
      horizonLe,
      modeleVersion: MODELE_VERSION,
      entrees,
    });
  };

  if (exercice) {
    const reussite = predireReussite(etat, difficulteVisee);
    if (reussite) {
      pousser("reussite", reussite.valeur, reussite.entrees, exercice.id, null);
    }
    const duree = predireDuree(exercice, tentatives);
    pousser("duree", duree.valeur, duree.entrees, exercice.id, null);
  }

  const retention = predireRetention(etat, now);
  if (retention) {
    pousser("retention", retention.valeur, retention.entrees, null, retention.horizonLe);
  }

  return { decision, predictions };
}
