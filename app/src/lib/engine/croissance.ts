/**
 * Ce que le travail récent a construit.
 *
 * ## Le défaut que ce module corrige
 *
 * L'Atelier s'ouvrait sur une grille de domaines : des cartes, un tri, un
 * bouton « Ajouter un domaine », un pourcentage de couverture. Un écran de
 * gestion. On n'y voyait ni ce qu'on venait de faire, ni ce que cela avait
 * changé — seulement l'inventaire de ce qu'il resterait à administrer.
 *
 * Les trois niveaux de lecture du chantier — *ce que j'ai fait*, *ce que cela a
 * changé*, *ce que je construis* — se dérivent tous de données déjà présentes :
 * `activiteSurFenetre` pour le temps, `evenementsRecents` pour les niveaux
 * avant/après, `construireVuesAtelier` pour les ensembles. Ce module n'assemble
 * que le premier et le deuxième ; le troisième est déjà rendu par les vues de
 * l'Atelier.
 *
 * ## Deux fenêtres, deux définitions différentes, et c'est volontaire
 *
 * « Aujourd'hui » est le **jour calendaire** : `joursDepuis` compte des tranches
 * de 24 h, et un exercice terminé hier à 23 h y passerait pour « aujourd'hui »
 * à 10 h ce matin. Sur un écran qui dit « aujourd'hui », ce serait faux.
 *
 * « 7 derniers jours » est une fenêtre **glissante**, et se nomme comme telle
 * plutôt que « cette semaine » — qui laisserait entendre un lundi.
 *
 * Rien n'est stocké : tout est recalculé depuis le journal (P1).
 */

import type {
  ExerciseAttempt,
  LearningSession,
  Skill,
  SkillObservation,
} from "@/lib/domain/types";
import { activiteSurFenetre, calculerActivite, evenementsRecents, type EvenementProgression } from "./historique";
import { cleJour, joursDepuis } from "./dates";

/**
 * Un palier franchi, au sens strict.
 *
 * `EvenementProgression.franchissement` vaut « le niveau n'est plus le même »,
 * ce qui inclut `null → 0` : une compétence rencontrée pour la première fois,
 * dont le protocole dit qu'elle est au niveau 0 — *Exposition, observation
 * insuffisante pour conclure à une compréhension*. Compter cela comme un palier
 * franchi ferait d'une absence de résultat une progression, et gonflerait le
 * compteur exactement là où il doit être sévère.
 *
 * Une première mesure a son propre compteur (`premieresMesures`) : elle est une
 * information, pas un progrès. Et une redescente n'est pas un franchissement non
 * plus — elle est dite ailleurs, dans l'impact de la tentative.
 */
function estProgression(evenement: EvenementProgression): boolean {
  return (
    evenement.niveauAvant !== null &&
    evenement.niveauApres !== null &&
    evenement.niveauApres > evenement.niveauAvant
  );
}

export interface FenetreCroissance {
  libelle: string;
  /** Minutes observées. Une séance sans durée notée compte 0 — pas d'invention. */
  minutes: number;
  joursActifs: number;
  seances: number;
  /** Tentatives réellement menées à terme, jamais les abandons. */
  exercicesMenes: number;
  observations: number;
  /** Codes travaillés, dans l'ordre de leur première observation de la fenêtre. */
  competencesTravaillees: string[];
  /** Observations ayant fait MONTER d'un palier. Ni les premières mesures, ni les reculs. */
  franchissements: number;
  /** Compétences mesurées pour la première fois de leur histoire. */
  premieresMesures: number;
}

export interface ResumeCroissance {
  jour: FenetreCroissance;
  semaine: FenetreCroissance;
  /** Les observations récentes avec leur effet réel, du plus récent au plus ancien. */
  evenements: EvenementProgression[];
  /** Vrai quand rien n'a été fait ni aujourd'hui ni sur les 7 derniers jours. */
  vide: boolean;
}

export interface EntreesCroissance {
  sessions: readonly LearningSession[];
  tentatives: readonly ExerciseAttempt[];
  observations: readonly SkillObservation[];
  /** Tout le référentiel, archivées comprises : une observation ancienne reste lisible (P4). */
  skillsParCode: ReadonlyMap<string, Skill>;
  /**
   * `dureeEstimeeMin` par exercice — le plafond du temps retenu pour une
   * tentative abandonnée (ADR-071). Sans elle, un exercice laissé ouvert une
   * nuit compte pour le garde-fou de 240 min au lieu de sa durée estimée, et
   * « TRAVAILLÉ » annonce un travail qui n'a pas eu lieu.
   */
  dureesEstimees?: ReadonlyMap<string, number>;
  now?: Date;
  /** Nombre d'événements de progression rendus. */
  limiteEvenements?: number;
}

/** Les observations du jour calendaire courant. */
function duJour(observations: readonly SkillObservation[], now: Date): SkillObservation[] {
  const aujourdhui = cleJour(now);
  return observations.filter((observation) => cleJour(observation.date) === aujourdhui);
}

/** Les observations des `jours` dernières tranches de 24 h. */
function deLaFenetre(observations: readonly SkillObservation[], jours: number, now: Date): SkillObservation[] {
  return observations.filter((observation) => joursDepuis(observation.date, now) <= jours);
}

/**
 * Une observation inaugure-t-elle la mesure de sa compétence ?
 *
 * Comparée à **tout** le journal, pas seulement à la fenêtre : une compétence
 * mesurée le mois dernier et retravaillée aujourd'hui n'est pas une première.
 */
function premieres(
  dansLaFenetre: readonly SkillObservation[],
  toutes: readonly SkillObservation[],
): number {
  const premiereParCode = new Map<string, string>();
  for (const observation of toutes) {
    const connue = premiereParCode.get(observation.skillCode);
    if (!connue || observation.date < connue) premiereParCode.set(observation.skillCode, observation.date);
  }
  return dansLaFenetre.filter((observation) => premiereParCode.get(observation.skillCode) === observation.date).length;
}

function construireFenetre(options: {
  libelle: string;
  observationsFenetre: readonly SkillObservation[];
  toutesObservations: readonly SkillObservation[];
  evenements: readonly EvenementProgression[];
  dansLaFenetre: (date: string) => boolean;
  tentatives: readonly ExerciseAttempt[];
  minutes: number;
  joursActifs: number;
  seances: number;
}): FenetreCroissance {
  const codes: string[] = [];
  for (const observation of [...options.observationsFenetre].sort((a, b) => a.date.localeCompare(b.date))) {
    if (!codes.includes(observation.skillCode)) codes.push(observation.skillCode);
  }

  return {
    libelle: options.libelle,
    minutes: options.minutes,
    joursActifs: options.joursActifs,
    seances: options.seances,
    exercicesMenes: options.tentatives.filter(
      (tentative) =>
        tentative.statut === "terminee" &&
        tentative.fin !== undefined &&
        options.dansLaFenetre(tentative.fin),
    ).length,
    observations: options.observationsFenetre.length,
    competencesTravaillees: codes,
    franchissements: options.evenements.filter(
      (evenement) => estProgression(evenement) && options.dansLaFenetre(evenement.date),
    ).length,
    premieresMesures: premieres(options.observationsFenetre, options.toutesObservations),
  };
}

export function resumeCroissance(entrees: EntreesCroissance): ResumeCroissance {
  const now = entrees.now ?? new Date();
  const sessions = [...entrees.sessions];
  const tentatives = [...entrees.tentatives];
  const observations = [...entrees.observations];

  /*
   * Les événements sont dérivés une seule fois, sur la fenêtre la plus large.
   *
   * `evenementsRecents` rejoue le journal — deux `computeSkillState` par observation
   * rendue. Le limiter au nombre d'observations de la semaine évite de payer le
   * rejeu de tout l'historique pour n'en afficher que quelques lignes.
   */
  const observationsSemaine = deLaFenetre(observations, 7, now);
  const limite = Math.max(
    entrees.limiteEvenements ?? 8,
    observationsSemaine.length,
  );
  const evenements = evenementsRecents(observations, entrees.skillsParCode, limite, now);

  const dureesEstimees = new Map(entrees.dureesEstimees ?? []);
  const activite = calculerActivite(sessions, now, tentatives, dureesEstimees);
  const semaine = activiteSurFenetre(sessions, 7, now, tentatives, dureesEstimees);
  const aujourdhui = cleJour(now);

  const jour = construireFenetre({
    libelle: "Aujourd'hui",
    observationsFenetre: duJour(observations, now),
    toutesObservations: observations,
    evenements,
    dansLaFenetre: (date) => cleJour(date) === aujourdhui,
    tentatives,
    minutes: activite.minutesParJour.get(aujourdhui) ?? 0,
    joursActifs: activite.minutesParJour.has(aujourdhui) ? 1 : 0,
    seances: sessions.filter((session) => cleJour(session.date) === aujourdhui).length,
  });

  const septJours = construireFenetre({
    libelle: "7 derniers jours",
    observationsFenetre: observationsSemaine,
    toutesObservations: observations,
    evenements,
    dansLaFenetre: (date) => joursDepuis(date, now) <= 7,
    tentatives,
    minutes: semaine.minutes,
    joursActifs: semaine.joursActifs,
    seances: semaine.seances,
  });

  return {
    jour,
    semaine: septJours,
    evenements: evenements.slice(0, entrees.limiteEvenements ?? 8),
    // Le vide se juge sur la semaine, pas sur le jour : ne rien avoir fait
    // depuis ce matin n'est pas ne rien avoir construit.
    vide: septJours.observations === 0 && septJours.exercicesMenes === 0 && septJours.minutes === 0,
  };
}
