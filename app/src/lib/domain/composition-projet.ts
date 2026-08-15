/**
 * Ce qu'une personne déclare pour ouvrir un projet.
 *
 * Un projet peut naître d'une demande explicite — « je veux travailler ces
 * compétences-là » — et non seulement d'une suggestion du moteur. C'est la
 * porte que la boucle adaptative n'avait pas : `ActivityGenerationRequest` était
 * toujours dérivée du classement, jamais demandée.
 *
 * Ce module est pur et sans dépendance : la route d'API et l'action serveur
 * s'en servent toutes deux, plutôt que de valider chacune de son côté. Une règle
 * métier partagée n'a qu'une implémentation.
 */

import type { EvaluationCriterion } from "./adaptive-learning";
import type { Dimension } from "./types";

/**
 * Le refus d'une composition mal formée.
 *
 * Cette classe vivait dans `adaptive-learning.ts`, avec les parseurs des tables
 * d'activité retirées le 15/08 (ADR-070). Elle revient ici parce que c'est le
 * seul module qui la lève encore : une erreur de validation appartient au
 * module qui valide, pas à un tronc commun qui n'a plus de tronc.
 */
export class CompositionProjetInvalide extends Error {
  constructor(public readonly champ: string, message: string) {
    super(`${champ}: ${message}`);
    this.name = "CompositionProjetInvalide";
  }
}

/**
 * La visée déclarée du projet.
 *
 * C'est une **intention**, pas une mesure : elle dit ce que le travail cherche
 * à mettre en jeu, et sert à formuler les critères. Ce que la production
 * démontre réellement se lit à l'évaluation, critère par critère.
 */
export const VISEES_PROJET = ["application", "transfert", "integration"] as const;
export type ViseeProjet = (typeof VISEES_PROJET)[number];

export const DUREE_PROJET_MIN = 30;
export const DUREE_PROJET_MAX = 480;
/** Au-delà, le contrat devient trop large pour qu'un critere reste lisible. */
export const COMPETENCES_MAX = 6;

export interface CompositionProjet {
  skillCodes: string[];
  objectif: string;
  dureeMin: number;
  capacite: "faible" | "standard" | "elevee";
  visee: ViseeProjet;
  contraintes: string[];
}

export interface CompetenceCiblee {
  code: string;
  intitule: string;
}

function erreur(champ: string, message: string): never {
  throw new CompositionProjetInvalide(`CompositionProjet.${champ}`, message);
}

/**
 * Relit une composition venue du formulaire.
 *
 * `codesAutorises` vient du référentiel du compte, résolu côté serveur : une
 * compétence qui n'y figure pas est refusée plutôt que créée. Le garde-fou est
 * le même que celui de la génération d'activité — aucun code n'entre par une
 * saisie.
 */
export function parseCompositionProjet(
  source: {
    skillCodes?: unknown;
    objectif?: unknown;
    dureeMin?: unknown;
    capacite?: unknown;
    visee?: unknown;
    contraintes?: unknown;
  },
  codesAutorises: ReadonlySet<string>,
): CompositionProjet {
  const codes = Array.isArray(source.skillCodes)
    ? [...new Set(source.skillCodes.filter((code): code is string => typeof code === "string" && code.trim().length > 0))]
    : [];
  if (codes.length === 0) erreur("skillCodes", "au moins une competence est requise");
  if (codes.length > COMPETENCES_MAX) {
    erreur("skillCodes", `pas plus de ${COMPETENCES_MAX} competences par projet`);
  }
  const inconnu = codes.find((code) => !codesAutorises.has(code));
  if (inconnu) erreur("skillCodes", `competence hors referentiel : ${inconnu}`);

  const objectif = typeof source.objectif === "string" ? source.objectif.trim() : "";
  if (objectif.length === 0) erreur("objectif", "un objectif est requis");

  const dureeMin = Number(source.dureeMin);
  if (!Number.isInteger(dureeMin) || dureeMin < DUREE_PROJET_MIN || dureeMin > DUREE_PROJET_MAX) {
    erreur("dureeMin", `duree attendue entre ${DUREE_PROJET_MIN} et ${DUREE_PROJET_MAX} minutes`);
  }

  const capacite = source.capacite;
  if (capacite !== "faible" && capacite !== "standard" && capacite !== "elevee") {
    erreur("capacite", "capacite mentale inconnue");
  }

  const visee = source.visee;
  if (typeof visee !== "string" || !VISEES_PROJET.includes(visee as ViseeProjet)) {
    erreur("visee", `visee attendue : ${VISEES_PROJET.join(", ")}`);
  }

  const contraintes = Array.isArray(source.contraintes)
    ? source.contraintes.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
    : [];

  return { skillCodes: codes, objectif, dureeMin, capacite, visee: visee as ViseeProjet, contraintes };
}

/** Identifiant de critère stable et lisible, dérivé du code de compétence. */
export function idCritereProjet(skillCode: string): string {
  return `critere-${skillCode.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

/**
 * Le contrat d'évaluation d'un projet composé.
 *
 * Un critère par compétence visée, portant son code : c'est ce rattachement
 * qui rend la preuve attribuable (ADR-068). Sans lui, la compétence figurerait
 * dans la cible sans que rien ne puisse dire si elle a été démontrée.
 *
 * Le tuteur ne fabrique pas ces critères : ils sont posés par le système à
 * partir du référentiel, et lui sont fournis comme contrainte.
 */
export function criteresProjet(
  competences: readonly CompetenceCiblee[],
  visee: ViseeProjet,
): EvaluationCriterion[] {
  const dimension: Dimension = visee === "transfert"
    ? "transfert"
    : visee === "integration"
      ? "integration"
      : "application";
  return competences.map((competence) => ({
    id: idCritereProjet(competence.code),
    label: `${competence.intitule} — ${LIBELLE_VISEE[visee]}`,
    dimension,
    skillCode: competence.code,
    required: true,
  }));
}

export const LIBELLE_VISEE: Record<ViseeProjet, string> = {
  application: "mise en oeuvre dans le projet",
  transfert: "transfert a un contexte nouveau",
  integration: "integration avec les autres competences du projet",
};

/**
 * Le segment honnête d'un projet long.
 *
 * Un projet de trois heures ne se mène pas d'un bloc ; annoncer qu'il faut tout
 * ce temps d'affilée rendrait la reprise impossible à proposer. Vingt minutes
 * est le plancher retenu, ou la durée totale si elle est plus courte — une
 * convention assumée, pas une observation.
 */
export function segmentProjet(dureeMin: number): number {
  return Math.min(20, dureeMin);
}
