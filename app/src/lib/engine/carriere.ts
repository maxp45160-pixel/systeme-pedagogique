/**
 * Le cumul d'une pratique, sur toute son histoire.
 *
 * Les autres agrégats du moteur regardent une fenêtre : `resumeCroissance` dit
 * la journée et la semaine, `calculerActivite` les trente derniers jours. Rien
 * ne disait ce que la pratique a totalisé depuis son premier jour — et c'est
 * pourtant la première question qu'on pose à un profil.
 *
 * ## Ce que ce module refuse de faire
 *
 * Il ne fabrique aucun palier, aucun rang, aucun titre. Tout ce qui suit est un
 * **comptage de faits déjà écrits** : des séances tenues, des tentatives
 * terminées, des observations enregistrées, des jours où quelque chose a eu lieu.
 * Un « niveau de carrière » calculé à partir de ces totaux serait une mesure
 * inventée, et l'invariant est clair : le score global existe déjà et se
 * dérive des observations, pas du temps passé (P2, P6).
 *
 * `null` plutôt que `0` partout où l'absence est réelle : une carrière qui n'a
 * pas commencé n'a pas une durée de zéro jour, elle n'a pas de durée.
 */

import type { ExerciseAttempt, LearningSession, SkillObservation } from "@/lib/domain/types";
import { seanceALieu } from "@/lib/domain/seance";
import { cleJour, joursDepuis } from "./dates";

export interface Carriere {
  /** Date de la toute première observation, ou `null` si aucune n'existe. */
  debut: string | null;
  /** Jours écoulés depuis cette première observation. `null` sans observation. */
  joursDepuisDebut: number | null;
  /** Minutes observées, toutes séances confondues. */
  minutesTotal: number;
  /** Séances qui ont eu lieu — une séance seulement planifiée n'en est pas une. */
  seancesTotal: number;
  /** Tentatives menées à terme. Un abandon ne produit pas d'observation (ADR-030). */
  exercicesMenes: number;
  observationsTotal: number;
  /** Jours distincts portant au moins une observation. */
  joursActifsTotal: number;
  /** Plus longue suite de jours consécutifs avec au moins une observation. */
  meilleureSerie: number;
  /**
   * Suite en cours, comptée jusqu'à aujourd'hui inclus.
   *
   * Une série reste « en cours » tant qu'elle touche aujourd'hui **ou** hier :
   * la casser à minuit ferait dépendre l'affichage de l'heure de consultation,
   * et quelqu'un qui travaille tous les soirs verrait sa série à zéro chaque
   * matin.
   */
  serieEnCours: number;
}

export interface EntreesCarriere {
  sessions: readonly LearningSession[];
  tentatives: readonly ExerciseAttempt[];
  observations: readonly SkillObservation[];
  now?: Date;
}

/**
 * Les jours distincts portant une observation, triés du plus ancien au plus récent.
 *
 * Les observations — et non les séances — parce que c'est l'observation qui atteste
 * qu'un travail a eu lieu. Une séance ouverte puis abandonnée ne fait pas un
 * jour actif.
 */
function joursAvecObservation(observations: readonly SkillObservation[]): string[] {
  return [...new Set(observations.map((observation) => cleJour(observation.date)))].sort();
}

/** Le jour suivant une clé `AAAA-MM-JJ`, dans la même convention. */
function jourSuivant(cle: string): string {
  const [annee, mois, jour] = cle.split("-").map(Number);
  const date = new Date(Date.UTC(annee, mois - 1, jour + 1));
  return cleJour(date);
}

/**
 * La plus longue suite de jours consécutifs, et celle qui court encore.
 *
 * Rend `{ meilleure: 0, enCours: 0 }` sur une liste vide — ici le zéro est
 * exact : il n'y a pas de série, et « pas de série » se compte bien zéro.
 */
function series(jours: string[], now: Date): { meilleure: number; enCours: number } {
  if (jours.length === 0) return { meilleure: 0, enCours: 0 };

  let meilleure = 1;
  let courante = 1;
  let debutDerniereSuite = jours[0];

  for (let i = 1; i < jours.length; i += 1) {
    if (jours[i] === jourSuivant(jours[i - 1])) {
      courante += 1;
    } else {
      courante = 1;
      debutDerniereSuite = jours[i];
    }
    if (courante > meilleure) meilleure = courante;
  }

  // La dernière suite ne court encore que si elle touche aujourd'hui ou hier.
  const dernier = jours[jours.length - 1];
  const ecart = joursDepuis(dernier, now);
  const enCours = ecart <= 1 ? courante : 0;
  // `debutDerniereSuite` n'est pas rendu : il n'est utile qu'au calcul, et
  // l'exposer inviterait à afficher une date de début de série qu'aucun écran
  // ne demande.
  void debutDerniereSuite;

  return { meilleure, enCours };
}

/**
 * Le cumul d'une pratique.
 *
 * Les tentatives comptées sont celles de statut `terminee` : une tentative
 * abandonnée ne produit pas d'observation, donc elle ne compte pas comme un
 * exercice mené — c'est la même règle que `resumeCroissance`.
 */
export function resumeCarriere(entrees: EntreesCarriere): Carriere {
  const now = entrees.now ?? new Date();

  const jours = joursAvecObservation(entrees.observations);
  const { meilleure, enCours } = series(jours, now);

  const debut = entrees.observations.length > 0
    ? entrees.observations.reduce(
        (plusAncienne, observation) => (observation.date < plusAncienne ? observation.date : plusAncienne),
        entrees.observations[0].date,
      )
    : null;

  /*
   * `seanceALieu` et non un filtre écrit ici : une séance seulement planifiée
   * ne doit pas compter comme du travail, et cette règle a déjà son unique
   * implémentation dans le domaine (voir son garde-fou sur `calculerActivite`).
   */
  const seancesTenues = entrees.sessions.filter(seanceALieu);

  return {
    debut,
    joursDepuisDebut: debut === null ? null : joursDepuis(debut, now),
    minutesTotal: seancesTenues.reduce((total, session) => total + (session.dureeMin ?? 0), 0),
    seancesTotal: seancesTenues.length,
    exercicesMenes: entrees.tentatives.filter((tentative) => tentative.statut === "terminee").length,
    observationsTotal: entrees.observations.length,
    joursActifsTotal: jours.length,
    meilleureSerie: meilleure,
    serieEnCours: enCours,
  };
}
