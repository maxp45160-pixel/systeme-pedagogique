/**
 * Simulation de parcours — types.
 *
 * Un scénario est une suite d'événements datés jouée contre le moteur réel.
 * Rien n'est persisté, rien n'est lu en base : le moteur étant pur et paramétré
 * (il reçoit les compétences, ADR-026), il suffit de lui fournir un référentiel
 * et un journal d'observations construit pas à pas.
 *
 * Ce module ne mesure pas l'apprenant : il mesure le SYSTÈME. Les états qu'il
 * produit sont des sorties d'inspection, jamais des preuves (invariant 2) — ils
 * ne doivent en aucun cas être écrits dans le journal d'un compte.
 */

import type { AideExterne } from "@/lib/engine/observation";
import type { Calibration } from "@/lib/engine/calibration";
import type {
  DecisionInscrite,
  MetriqueMoteur,
  PredictionInscrite,
} from "@/lib/engine/auto-evaluation";
import type { Recommandation } from "@/lib/engine/recommend";
import type { EtatGlobal } from "@/lib/engine/progression";
import type {
  Dimension,
  Domaine,
  Exercise,
  ExerciseAttempt,
  SkillObservation,
  SkillState,
  Skill,
} from "@/lib/domain/types";

/** Un événement du scénario, daté en ISO. */
export type EvenementScenario =
  | {
      type: "tentative";
      date: string;
      exercice: string;
      resultat: "reussi" | "partiel" | "echec";
      indicesUtilises: number;
      dureeMin: number;
      aideExterne?: AideExterne;
      /** Dimensions démontrées, telles que l'évaluation les aurait remplies. */
      evaluation?: Partial<Record<Dimension, number>>;
    }
  | {
      /** Tentative interrompue : elle ne produit aucune preuve (garde-fou). */
      type: "tentative-abandonnee";
      date: string;
      exercice: string;
      dureeMin: number;
    }
  | {
      /** Rien ne se passe pendant N jours — teste l'oubli et la révision due. */
      type: "attente";
      date: string;
      jours: number;
    };

export interface Scenario {
  id: string;
  nom: string;
  /** Ce que le scénario cherche à mettre en évidence. */
  intention: string;
  domaines: Domaine[];
  competences: Skill[];
  exercices: Exercise[];
  evenements: EvenementScenario[];
}

export type GraviteAnomalie = "info" | "avertissement" | "invariant";

export interface Anomalie {
  /** Identifiant stable de la règle violée. */
  regle: string;
  gravite: GraviteAnomalie;
  message: string;
  /** Compétence concernée, quand la règle en désigne une. */
  competence?: string;
}

/** L'état du système après un événement. */
export interface PasSimulation {
  index: number;
  date: string;
  /** Résumé lisible de l'événement joué. */
  evenement: string;
  etats: SkillState[];
  calibrations: Map<string, Calibration>;
  recommandations: Recommandation[];
  global: EtatGlobal;
  observations: SkillObservation[];
  tentatives: ExerciseAttempt[];
  anomalies: Anomalie[];
}

export interface ResultatSimulation {
  scenario: Scenario;
  pas: PasSimulation[];
  /** Toutes les anomalies, dans l'ordre d'apparition. */
  anomalies: (Anomalie & { pas: number; date: string })[];
  /**
   * Ce que le moteur a affirmé pendant le parcours, et ce qu'il a décidé.
   *
   * Inscrites au moment où l'action est **servie**, comme en production
   * (`journaliserActionServie`) — sans quoi le journal ne contiendrait que les
   * recommandations suivies et ne pourrait que donner raison au moteur.
   */
  predictions: PredictionInscrite[];
  decisions: DecisionInscrite[];
  /**
   * Les quatre métriques d'auto-évaluation (ADR-085) calculées sur ce parcours
   * simulé. Mêmes seuils qu'en production : sous le seuil, la valeur reste
   * `null`. Une métrique simulée ne dit rien du moteur en vrai — elle dit
   * seulement ce que le moteur ferait de ce jeu de données.
   */
  metriques: MetriqueMoteur[];
  /**
   * L'aptitude réelle de l'apprenant simulé, compétence par compétence.
   *
   * Présente pour un parcours piloté seulement : c'est ce que le modèle
   * d'apprenant sait et que le moteur ignore. Absente d'une liste d'événements
   * écrite à la main — personne n'y connaît l'aptitude, et en inventer une
   * serait exactement le défaut que cet outil traque.
   */
  veriteTerrain?: Record<string, number>;
}
