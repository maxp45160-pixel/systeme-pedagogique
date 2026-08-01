/**
 * Répétition espacée — « quand réviser cette compétence ? »
 *
 * L'intervalle de révision se DÉRIVE de l'état de la compétence, jamais d'un
 * état stocké (P1). Aucune colonne `prochaine_revision` en base : tout se
 * recalcule à la lecture, comme le niveau et la robustesse.
 *
 * ── Architecture : un modèle de mémoire, remplaçable ─────────────────────
 *
 * Le calcul de l'intervalle est isolé derrière l'interface `ModeleRevision`.
 * Deux implémentations coexistent :
 *
 *   • `modeleHeuristique` (méthode A') — l'actuelle. L'intervalle est le
 *     produit de facteurs dérivés de l'état (niveau, robustesse, confiance,
 *     dernier résultat). Simple, transparent, testé.
 *
 *   • `modeleFsrs` (méthode C, à venir) — un modèle de mémoire à la FSRS
 *     (stabilité S, difficulté D, récupérabilité R) calibré sur les données
 *     réelles. Plus fondé théoriquement, mais exige une calibration.
 *
 * Les appelants (`prochaineRevision`, `estDue`, la recommandation, l'interface)
 * ne connaissent que l'interface : passer de A' à C ne touche qu'à
 * `MODELE_ACTIF`, rien d'autre. Même pattern que la calibration (ADR-028).
 *
 * Chaque facteur cite sa source (niveau, robustesse, confiance, dernier
 * résultat) — pattern P3 : aucun nombre sans sa justification.
 */

import type { SkillState } from "@/lib/domain/types";
import { joursDepuis } from "./dates";

/* ------------------------------------------------------------------ */
/* Seuils de la méthode A' — chacun justifié, aucun n'est une intuition */
/* ------------------------------------------------------------------ */

/**
 * Intervalle de base, en jours, pour une compétence fraîchement acquise
 * (niveau 1, robustesse nulle, confiance faible) : on la révise le lendemain.
 */
export const INTERVALLE_BASE_JOURS = 1;

/**
 * Multiplicateur par palier de niveau. La progression est géométrique :
 * chaque palier double l'intervalle. Niveau 1 → ×1, niveau 5 → ×16.
 *
 * Justification : le niveau 3 exige déjà deux résolutions autonomes
 * concordantes (instructions §11) — une compétence à 3 est nettement plus
 * stable qu'à 1, et peut attendre ~4 jours avant révision.
 */
export const FACTEUR_NIVEAU: Record<number, number> = {
  0: 1,
  1: 1,
  2: 2,
  3: 4,
  4: 8,
  5: 16,
};

/**
 * Amplitude du facteur de robustesse : `1 + robustesse × AMPLITUDE`.
 * Robustesse 0 → ×1 (fragile, réviser tôt) ; robustesse 1 → ×(1+AMPLITUDE).
 *
 * La robustesse est le proxy de stabilité du système (protocole d'évaluation
 * §13 : nombre de preuves, diversité des contextes, autonomie, récence,
 * réussite après délai, transfert). Une robustesse 0,8 multiplie l'intervalle
 * par 3,4 — c'est le signal dominant, comme il se doit.
 */
export const AMPLITUDE_ROBUSTESSE = 3;

/**
 * Multiplicateur selon la confiance (protocole anti-hallucination §10).
 * Une confiance faible signifie peu de preuves ou des contradictions : on
 * révise plus tôt pour consolider. Une confiance forte permet d'attendre.
 */
export const FACTEUR_CONFIANCE: Record<string, number> = {
  nulle: 0.5,
  faible: 0.5,
  moyenne: 1,
  forte: 1.5,
};

/**
 * Multiplicateur selon le résultat de la dernière preuve (variante A').
 * Un échec récent rapproche la révision (on revient vérifier vite) ; une
 * réussite autonome laisse l'intervalle plein.
 */
export const FACTEUR_DERNIER_RESULTAT: Record<string, number> = {
  echec: 0.5,
  partiel: 0.75,
  reussi: 1,
};

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface FacteurIntervalle {
  libelle: string;
  valeur: string;
  multiplicateur: number;
}

export interface ProchaineRevision {
  /** La compétence est-elle à réviser aujourd'hui ? */
  due: boolean;
  /** Intervalle calculé, en jours. */
  intervalleJours: number;
  /** Jours écoulés depuis la dernière preuve. */
  joursEcoules: number | null;
  /** Facteurs qui composent l'intervalle, pour le « Pourquoi ? ». */
  facteurs: FacteurIntervalle[];
  /** Phrase de synthèse, construite depuis les facteurs réels. */
  raison: string;
}

/**
 * Un modèle de mémoire : étant donné l'état d'une compétence, il produit
 * l'intervalle de révision et les facteurs qui l'expliquent.
 *
 * C'est l'abstraction qui permet de passer de la méthode A' (heuristique) à
 * la méthode C (FSRS) sans toucher aux appelants. Un modèle FSRS rendrait
 * `intervalle` depuis une probabilité de rappel `R = e^(−t/S)` et un seuil.
 */
export interface ModeleRevision {
  /** Intervalle en jours, ou `null` si la compétence n'a aucune preuve. */
  intervalle(etat: SkillState): number | null;
  /** Facteurs explicatifs, pour l'affichage « Pourquoi ? ». */
  facteurs(etat: SkillState): FacteurIntervalle[];
}

/* ------------------------------------------------------------------ */
/* Méthode A' — modèle heuristique                                     */
/* ------------------------------------------------------------------ */

/**
 * Les facteurs qui composent l'intervalle, avec leur multiplicateur.
 *
 * Source unique de vérité : `intervalle` et `facteurs` s'appuient tous deux
 * sur cette fonction, pour qu'un facteur ne puisse pas diverger entre le
 * calcul et l'affichage (P3 — aucun nombre sans sa source).
 */
function facteursHeuristiques(etat: SkillState): FacteurIntervalle[] {
  const facteurs: FacteurIntervalle[] = [];

  const fNiveau = FACTEUR_NIVEAU[etat.niveau ?? 0] ?? 1;
  facteurs.push({
    libelle: "Niveau",
    valeur: `${etat.niveau ?? 0}/5`,
    multiplicateur: fNiveau,
  });

  const robustesse = etat.robustesse ?? 0;
  facteurs.push({
    libelle: "Robustesse",
    valeur: robustesse.toFixed(2),
    multiplicateur: 1 + robustesse * AMPLITUDE_ROBUSTESSE,
  });

  facteurs.push({
    libelle: "Confiance",
    valeur: etat.confiance,
    multiplicateur: FACTEUR_CONFIANCE[etat.confiance] ?? 1,
  });

  // Dernier résultat : la dernière preuve triée par date.
  const derniere = etat.preuves.at(-1);
  facteurs.push({
    libelle: "Dernier résultat",
    valeur: derniere ? derniere.resultat : "—",
    multiplicateur: derniere ? FACTEUR_DERNIER_RESULTAT[derniere.resultat] ?? 1 : 1,
  });

  return facteurs;
}

/**
 * Méthode A' — l'intervalle est le produit des facteurs dérivés de l'état.
 *
 * `null` si la compétence n'a aucune preuve : elle n'est pas « à réviser »,
 * elle est « à diagnostiquer ». Les deux flux sont distincts — la
 * recommandation traite le diagnostic par son propre bloc.
 */
export const modeleHeuristique: ModeleRevision = {
  intervalle(etat) {
    if (etat.preuves.length === 0) return null;
    const facteurs = facteursHeuristiques(etat);
    const intervalle = facteurs.reduce(
      (acc, f) => acc * f.multiplicateur,
      INTERVALLE_BASE_JOURS,
    );
    return Math.max(1, Math.round(intervalle));
  },
  facteurs: facteursHeuristiques,
};

/* ------------------------------------------------------------------ */
/* Méthode C — modèle FSRS (à venir)                                   */
/* ------------------------------------------------------------------ */

/**
 * Emplacement réservé pour la méthode C (FSRS).
 *
 * Un modèle FSRS dériverait la stabilité S et la difficulté D de l'état, puis
 * l'intervalle depuis la récupérabilité cible : `intervalle = −S × ln(R_cible)`.
 * Il exige une calibration sur les données réelles du système (combien de
 * jours une robustesse donnée représente-t-elle ?) — c'est pourquoi il n'est
 * pas implémenté ici. L'interface `ModeleRevision` est déjà en place pour
 * l'accueillir sans toucher aux appelants.
 */
export const modeleFsrs: ModeleRevision | null = null;

/**
 * Le modèle actif. Changer de méthode = changer cette constante, rien d'autre.
 */
export const MODELE_ACTIF: ModeleRevision = modeleHeuristique;

/* ------------------------------------------------------------------ */
/* Point d'entrée                                                      */
/* ------------------------------------------------------------------ */

/**
 * La compétence est-elle due pour révision aujourd'hui ?
 *
 * Une compétence sans preuve n'est jamais « due » : elle est à diagnostiquer,
 * pas à réviser. `due` ne vaut donc vrai que si une preuve existe ET que
 * l'intervalle est dépassé.
 */
export function estDue(etat: SkillState, now: Date = new Date()): boolean {
  const intervalle = MODELE_ACTIF.intervalle(etat);
  if (intervalle === null) return false;
  const ecoules = etat.joursDepuisDernierePreuve ?? joursDepuis(etat.dernierePreuve ?? "", now);
  return ecoules >= intervalle;
}

/**
 * Point d'entrée unique : tout ce qu'un appelant a besoin de savoir sur la
 * révision d'une compétence, avec la justification de chaque facteur.
 */
export function prochaineRevision(etat: SkillState, now: Date = new Date()): ProchaineRevision {
  const intervalle = MODELE_ACTIF.intervalle(etat);
  const joursEcoules = etat.joursDepuisDernierePreuve ?? joursDepuis(etat.dernierePreuve ?? "", now);

  if (intervalle === null) {
    return {
      due: false,
      intervalleJours: 0,
      joursEcoules,
      facteurs: [],
      raison: "Aucune preuve : compétence à diagnostiquer, pas à réviser.",
    };
  }

  const due = joursEcoules >= intervalle;
  const facteurs = MODELE_ACTIF.facteurs(etat);

  const raison = due
    ? `Due pour révision : ${joursEcoules} jours écoulés pour un intervalle de ${intervalle} jours.`
    : `Prochaine révision dans ${intervalle - joursEcoules} jour(s) (intervalle ${intervalle} jours, ${joursEcoules} écoulés).`;

  return {
    due,
    intervalleJours: intervalle,
    joursEcoules,
    facteurs,
    raison,
  };
}