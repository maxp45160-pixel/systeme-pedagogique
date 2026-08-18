/**
 * Les réglages que le moteur a le droit de changer lui-même — ADR-085.
 *
 * ## Ce que ce module rend possible, et ce qu'il empêche
 *
 * `CLAUDE.md` interdit de « modifier les seuils de calibration sans données
 * justifiant le changement ». Jusqu'au 18/08/2026 cette règle était
 * indécidable : aucune donnée n'existait. Le lot 2 les produit, le lot 3 les
 * mesure, et ce module est le seul endroit d'où un seuil peut bouger.
 *
 * Il est écrit pour **empêcher** plus que pour permettre :
 *
 * - seuls les paramètres inscrits au registre ci-dessous sont touchables ;
 * - chacun a une **borne**, et un **pas maximal** par ajustement ;
 * - **un seul** ajustement est proposé à la fois, et jamais avant la fin de la
 *   fenêtre d'observation du précédent ;
 * - un paramètre dont la métrique déclenchante n'existe pas n'est **jamais**
 *   ajusté automatiquement, même s'il est réglable à la main.
 *
 * ## Rien n'est écrit dans le code
 *
 * Les `export const` de `calibration.ts`, `spaced.ts` et `recommend.ts`
 * restent les **valeurs par défaut**. L'état courant est le défaut plus le
 * rejeu du journal : `moteur_reglages` seul reconstitue n'importe quel état
 * passé, et une annulation est une ligne de plus, jamais un `DELETE`.
 */

import { FRACTION_TROP_FACILE, SIGNAUX_CONCORDANTS } from "./calibration";
import { AMPLITUDE_ROBUSTESSE } from "./spaced";
import { BONUS_ACTIONNABLE } from "./recommend";
import type { MetriqueMoteur, NomMetrique } from "./auto-evaluation";
import { joursEntre } from "./dates";

/* ------------------------------------------------------------------ */
/* Le registre                                                         */
/* ------------------------------------------------------------------ */

export type NomParametre =
  | "fractionTropFacile"
  | "signauxConcordants"
  | "amplitudeRobustesse"
  | "bonusActionnable";

export interface ParametreReglable {
  nom: NomParametre;
  libelle: string;
  /** Où vit la valeur par défaut — pour qu'on puisse aller la relire. */
  origine: string;
  defaut: number;
  min: number;
  max: number;
  /** Pas maximal par ajustement, en fraction de l'amplitude de la borne. */
  pasMaximal: number;
  /** Entier obligatoire — un « nombre de signaux » ne vaut pas 2,4. */
  entier: boolean;
  /**
   * La métrique qui autorise un ajustement automatique.
   *
   * `null` = réglable à la main, dans sa borne et au journal, mais **jamais
   * proposé par le moteur**. On n'invente pas une règle d'ajustement pour un
   * paramètre dont aucune mesure ne dit dans quel sens le pousser.
   */
  metrique: NomMetrique | null;
}

/**
 * Le pas par défaut : 20 % de l'amplitude de la borne.
 *
 * Un ajustement doit être un pas, jamais un saut. Un seuil qui traverse sa
 * borne en une fois rend l'effet du changement inobservable — on ne saurait
 * plus si l'amélioration vient du réglage ou d'autre chose.
 */
export const PAS_PAR_DEFAUT = 0.2;

/**
 * Jours d'observation avant qu'un paramètre puisse rebouger.
 *
 * Sans fenêtre, deux calculs successifs le même jour pousseraient deux fois
 * dans la même direction sur la même mesure — le moteur s'emballerait sur une
 * observation unique, exactement ce qu'ADR-045 a corrigé pour la difficulté
 * conseillée en exigeant deux signaux concordants.
 */
export const FENETRE_OBSERVATION_JOURS = 14;

export const PARAMETRES_REGLABLES: ParametreReglable[] = [
  {
    nom: "fractionTropFacile",
    libelle: "Seuil « réussite trop rapide »",
    origine: "lib/engine/calibration.ts — FRACTION_TROP_FACILE",
    defaut: FRACTION_TROP_FACILE,
    min: 0.4,
    max: 0.8,
    pasMaximal: PAS_PAR_DEFAUT,
    entier: false,
    metrique: "erreur-duree",
  },
  {
    nom: "amplitudeRobustesse",
    libelle: "Poids de la robustesse dans l'intervalle de révision",
    origine: "lib/engine/spaced.ts — AMPLITUDE_ROBUSTESSE",
    defaut: AMPLITUDE_ROBUSTESSE,
    min: 1,
    max: 5,
    pasMaximal: PAS_PAR_DEFAUT,
    entier: false,
    metrique: "brier-retention",
  },
  {
    nom: "signauxConcordants",
    libelle: "Signaux concordants avant de bouger la difficulté",
    origine: "lib/engine/calibration.ts — SIGNAUX_CONCORDANTS",
    defaut: SIGNAUX_CONCORDANTS,
    min: 2,
    max: 4,
    pasMaximal: PAS_PAR_DEFAUT,
    entier: true,
    // Aucune métrique ne mesure l'oscillation de la difficulté conseillée.
    // Le plan en prévoyait une ; elle n'existe pas, donc pas de règle.
    metrique: null,
  },
  {
    nom: "bonusActionnable",
    libelle: "Bonus d'actionnabilité au classement",
    origine: "lib/engine/recommend.ts — BONUS_ACTIONNABLE",
    defaut: BONUS_ACTIONNABLE,
    min: 0,
    max: 25,
    pasMaximal: PAS_PAR_DEFAUT,
    entier: true,
    /*
     * Volontairement `null`, contre le plan initial.
     *
     * `utilite-recommandation` mesure la part de recommandations suivies, en
     * excluant déjà celles sans exercice. Un taux bas ne dit donc PAS que le
     * bonus d'actionnabilité est mal réglé — il dit que les exercices proposés
     * ne donnent pas envie, ce que ce bonus ne peut pas corriger. Fabriquer un
     * lien entre les deux aurait produit un ajustement qui se justifie par une
     * mesure qu'il n'améliore pas.
     */
    metrique: null,
  },
];

export const PARAMETRE_PAR_NOM = new Map(PARAMETRES_REGLABLES.map((p) => [p.nom, p]));

/* ------------------------------------------------------------------ */
/* L'état courant                                                      */
/* ------------------------------------------------------------------ */

export type Reglages = Record<NomParametre, number>;

export const REGLAGES_PAR_DEFAUT: Reglages = Object.fromEntries(
  PARAMETRES_REGLABLES.map((p) => [p.nom, p.defaut]),
) as Reglages;

/** Une ligne du journal `moteur_reglages`. Immuable, comme tout le reste. */
export interface AjustementInscrit {
  id: string;
  appliqueLe: string;
  parametre: NomParametre;
  valeurAvant: number;
  valeurApres: number;
  metrique: string;
  n: number;
  valeurMetrique: number;
  motif: string;
}

/** Contraint une valeur à la borne de son paramètre, et à son type. */
export function borner(parametre: ParametreReglable, valeur: number): number {
  const borne = Math.min(parametre.max, Math.max(parametre.min, valeur));
  return parametre.entier ? Math.round(borne) : borne;
}

/**
 * L'état courant : les défauts, plus le rejeu du journal dans l'ordre.
 *
 * Le rejeu, et non « la dernière valeur écrite » : c'est ce qui rend le journal
 * suffisant. Reconstituer l'état d'il y a trois semaines ne demande que de
 * rejouer jusqu'à cette date.
 *
 * Une ligne dont le paramètre a disparu du registre est ignorée — un réglage
 * retiré du code ne doit pas faire échouer la lecture d'un journal ancien.
 */
export function reglagesEffectifs(journal: AjustementInscrit[]): Reglages {
  const reglages: Reglages = { ...REGLAGES_PAR_DEFAUT };
  const ordonne = [...journal].sort((a, b) => a.appliqueLe.localeCompare(b.appliqueLe));

  for (const ligne of ordonne) {
    const parametre = PARAMETRE_PAR_NOM.get(ligne.parametre);
    if (!parametre) continue;
    reglages[ligne.parametre] = borner(parametre, ligne.valeurApres);
  }
  return reglages;
}

/* ------------------------------------------------------------------ */
/* La proposition d'ajustement                                         */
/* ------------------------------------------------------------------ */

export interface PropositionAjustement {
  parametre: NomParametre;
  libelle: string;
  valeurAvant: number;
  valeurApres: number;
  metrique: NomMetrique;
  n: number;
  valeurMetrique: number;
  /** Phrase construite depuis les valeurs réelles — jamais rédigée d'avance. */
  motif: string;
}

/** Applique le pas maximal : on va VERS la cible, jamais jusqu'à elle d'un coup. */
function versLaCible(
  parametre: ParametreReglable,
  actuel: number,
  cible: number,
): number {
  const pas = (parametre.max - parametre.min) * parametre.pasMaximal;
  const ecart = cible - actuel;
  const borne = Math.sign(ecart) * Math.min(Math.abs(ecart), pas);
  return borner(parametre, actuel + borne);
}

/** Le paramètre a-t-il bougé trop récemment pour rebouger ? */
function sousObservation(
  nom: NomParametre,
  journal: AjustementInscrit[],
  maintenant: Date,
): boolean {
  const dernier = journal
    .filter((l) => l.parametre === nom)
    .sort((a, b) => b.appliqueLe.localeCompare(a.appliqueLe))[0];
  if (!dernier) return false;
  return joursEntre(dernier.appliqueLe, maintenant) < FENETRE_OBSERVATION_JOURS;
}

/**
 * La cible visée pour `fractionTropFacile`, depuis le biais de durée observé.
 *
 * Le seuil sépare « réussi vite » de « réussi normalement ». Il se compare à
 * `durée réelle / durée de référence`. Si le ratio médian observé vaut 0,48 —
 * la valeur relevée le 09/08/2026, ADR-045 — alors un seuil à 0,6 classe la
 * MOITIÉ des réussites normales comme « trop faciles ».
 *
 * La cible est donc placée **sous** le ratio typique : `ratio × 0,8`. Une
 * réussite n'est dite rapide que si elle est nettement plus rapide que
 * l'ordinaire, pas seulement dans la moyenne.
 *
 * ⚠️ Le coefficient 0,8 n'est pas mesuré. Il est là pour être réfuté, comme les
 * constantes de `prediction.ts` : si les « trop-facile » disparaissent
 * complètement après ajustement, il est trop bas.
 */
export const MARGE_RAPIDITE = 0.8;

/** En deçà de cet écart, on ne bouge pas : le bruit ne justifie pas un pas. */
export const TOLERANCE_FRACTION = 0.05;
export const TOLERANCE_BRIER = 0.05;

/**
 * Ce que le moteur propose de changer, et pourquoi.
 *
 * **Au plus une proposition**, celle du paramètre dont l'écart à sa cible est
 * le plus grand. Deux réglages bougés ensemble rendraient l'effet de chacun
 * indiscernable — et c'est tout l'objet du lot 3 de pouvoir l'observer.
 */
export function proposerAjustements(options: {
  metriques: MetriqueMoteur[];
  journal: AjustementInscrit[];
  maintenant: Date;
}): PropositionAjustement | null {
  const { metriques, journal, maintenant } = options;
  const reglages = reglagesEffectifs(journal);
  const parNom = new Map(metriques.map((m) => [m.nom, m]));
  const candidats: (PropositionAjustement & { ecart: number })[] = [];

  for (const parametre of PARAMETRES_REGLABLES) {
    if (parametre.metrique === null) continue;
    if (sousObservation(parametre.nom, journal, maintenant)) continue;

    const metrique = parNom.get(parametre.metrique);
    // `valeur === null` : la métrique est sous son seuil. Rien ne bouge — c'est
    // la garantie que « sans données justifiant le changement » est tenue.
    if (!metrique || metrique.valeur === null) continue;

    const actuel = reglages[parametre.nom];
    let cible: number | null = null;
    let motif = "";

    if (parametre.nom === "fractionTropFacile") {
      const ratio = metrique.valeur;
      cible = ratio * MARGE_RAPIDITE;
      if (Math.abs(cible - actuel) < TOLERANCE_FRACTION) continue;
      motif =
        `Sur ${metrique.n} durées confrontées, le réel vaut ${ratio.toFixed(2)} fois l'annoncé. ` +
        `Un seuil à ${actuel.toFixed(2)} classe des réussites ordinaires comme trop rapides.`;
    }

    if (parametre.nom === "amplitudeRobustesse") {
      const agregats = metrique.agregats;
      if (!agregats) continue;
      const ecartModele = agregats.preditMoyen - agregats.observeMoyen;
      if (Math.abs(ecartModele) < TOLERANCE_BRIER) continue;
      // Modèle trop optimiste : les intervalles sont trop longs, on resserre.
      cible = ecartModele > 0 ? parametre.min : parametre.max;
      motif =
        ecartModele > 0
          ? `Sur ${metrique.n} révisions tranchées, le moteur annonçait ${(agregats.preditMoyen * 100).toFixed(0)} % de rétention pour ${(agregats.observeMoyen * 100).toFixed(0)} % observés : les intervalles sont trop longs.`
          : `Sur ${metrique.n} révisions tranchées, le moteur annonçait ${(agregats.preditMoyen * 100).toFixed(0)} % de rétention pour ${(agregats.observeMoyen * 100).toFixed(0)} % observés : les intervalles sont trop courts.`;
    }

    if (cible === null) continue;
    const valeurApres = versLaCible(parametre, actuel, cible);
    if (valeurApres === actuel) continue;

    candidats.push({
      parametre: parametre.nom,
      libelle: parametre.libelle,
      valeurAvant: actuel,
      valeurApres,
      metrique: parametre.metrique,
      n: metrique.n,
      valeurMetrique: metrique.valeur,
      motif,
      ecart: Math.abs(cible - actuel),
    });
  }

  if (candidats.length === 0) return null;
  // Le plus grand écart à sa cible passe devant : c'est le réglage dont le
  // désaccord avec la mesure est le plus net, donc celui dont l'effet sera le
  // plus lisible une fois la fenêtre d'observation écoulée.
  candidats.sort((a, b) => b.ecart - a.ecart);
  const retenu = candidats[0];
  return {
    parametre: retenu.parametre,
    libelle: retenu.libelle,
    valeurAvant: retenu.valeurAvant,
    valeurApres: retenu.valeurApres,
    metrique: retenu.metrique,
    n: retenu.n,
    valeurMetrique: retenu.valeurMetrique,
    motif: retenu.motif,
  };
}
