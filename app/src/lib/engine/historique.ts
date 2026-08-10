/**
 * Reconstitution de l'historique par rejeu du journal.
 *
 * Aucune progression n'est stockée : pour savoir qu'une compétence est passée
 * du niveau 2 au niveau 3, on recalcule son état avant et après la preuve
 * concernée. C'est plus coûteux qu'un champ « niveau précédent », mais cela
 * garantit qu'un historique affiché correspond toujours aux preuves présentes
 * — il ne peut pas dériver.
 */

import type {
  Domaine,
  DomaineId,
  LearningSession,
  NiveauCompetence,
  Skill,
  SkillEvidence,
} from "@/lib/domain/types";
import { seanceALieu } from "@/lib/domain/seance";
import { JOUR_MS } from "./dates";
import { computeSkillState } from "./skill-state";
import { calculerEtatGlobal } from "./progression";
import { cleJour, joursDepuis } from "./dates";

/* ------------------------------------------------------------------ */
/* Événements de progression                                           */
/* ------------------------------------------------------------------ */

export interface EvenementProgression {
  date: string;
  skillCode: string;
  intitule: string;
  domaine: DomaineId;
  niveauAvant: NiveauCompetence | null;
  niveauApres: NiveauCompetence | null;
  /** Vrai si cette preuve a fait franchir un palier. */
  franchissement: boolean;
  resultat: SkillEvidence["resultat"];
  type: SkillEvidence["type"];
  contexte: string;
  commentaire?: string;
}

/**
 * Liste les preuves les plus récentes en indiquant leur effet réel sur le
 * niveau. Une preuve qui ne change rien est conservée dans la liste : le
 * travail sans franchissement de palier est une information utile, pas un
 * échec à masquer.
 */
export function evenementsRecents(
  preuves: SkillEvidence[],
  skillsParCode: Map<string, Skill>,
  limite = 8,
  now: Date = new Date(),
): EvenementProgression[] {
  const triees = [...preuves].sort((a, b) => a.date.localeCompare(b.date));

  // `computeSkillState` commence par filtrer sur `skillCode` : l'état « avant »
  // calculé sur `triees.slice(0, i)` vaut donc exactement l'état calculé sur le
  // seul historique de cette compétence, tronqué au rang qu'y occupe la preuve.
  // On regroupe une fois par compétence en mémorisant ce rang, puis on ne dérive
  // que les `limite` preuves réellement rendues.
  //
  // La version précédente dérivait les n preuves — deux `computeSkillState` et
  // deux copies du tableau complet chacune — pour n'en garder que `limite` à la
  // dernière ligne. Sur le journal, qui ne fait que croître et demande 200
  // évènements, ce coût était quadratique.
  const parCode = new Map<string, SkillEvidence[]>();
  const rangDansSaCompetence = new Array<number>(triees.length);

  for (let i = 0; i < triees.length; i++) {
    const historique = parCode.get(triees[i].skillCode);
    if (historique) {
      rangDansSaCompetence[i] = historique.length;
      historique.push(triees[i]);
    } else {
      rangDansSaCompetence[i] = 0;
      parCode.set(triees[i].skillCode, [triees[i]]);
    }
  }

  const evenements: EvenementProgression[] = [];

  for (let i = triees.length - 1; i >= 0 && evenements.length < limite; i--) {
    const preuve = triees[i];
    // `skillsParCode` doit couvrir TOUT le référentiel du compte, archivées
    // comprises — c'est `Referentiel.parCode`, pas `actifs`. Une compétence
    // sortie du périmètre garde ses preuves, et son historique doit rester
    // lisible (P4).
    const skill = skillsParCode.get(preuve.skillCode);
    // Preuve hors référentiel : ignorée sans consommer de place dans la liste.
    // Depuis ADR-027 la clé étrangère `evidence_competence_fk` rend ce cas
    // impossible en base ; le garde reste pour les journaux importés et les
    // tests.
    if (!skill) continue;

    const historique = parCode.get(preuve.skillCode)!;
    const rang = rangDansSaCompetence[i];
    const avant = computeSkillState(skill, historique.slice(0, rang), now);
    const apres = computeSkillState(skill, historique.slice(0, rang + 1), now);

    evenements.push({
      date: preuve.date,
      skillCode: preuve.skillCode,
      intitule: skill.intitule,
      domaine: skill.domaine,
      niveauAvant: avant.niveau,
      niveauApres: apres.niveau,
      franchissement: avant.niveau !== apres.niveau,
      resultat: preuve.resultat,
      type: preuve.type,
      contexte: preuve.contexte,
      commentaire: preuve.commentaire,
    });
  }

  // Déjà du plus récent au plus ancien : le parcours part de la fin.
  return evenements;
}

/* ------------------------------------------------------------------ */
/* Photographies périodiques                                           */
/* ------------------------------------------------------------------ */

export interface Photographie {
  date: string;
  scoreGlobal: number | null;
  competencesEvaluees: number;
  nombrePreuves: number;
  parDomaine: Map<DomaineId, number | null>;
}

/**
 * Recalcule l'état global à intervalles réguliers sur une fenêtre donnée.
 * `pas` en jours ; 14 par défaut, pour éviter le bruit d'une courbe
 * quotidienne sur un phénomène qui évolue en semaines.
 */
export function photographies(
  skills: Skill[],
  preuves: SkillEvidence[],
  jours: number,
  pas = 14,
  now: Date = new Date(),
  domaines: Domaine[] = [],
): Photographie[] {
  const triees = [...preuves].sort((a, b) => a.date.localeCompare(b.date));
  const sorties: Photographie[] = [];

  for (let d = jours; d >= 0; d -= pas) {
    const instant = new Date(now.getTime() - d * JOUR_MS);
    const jusque = triees.filter((e) => new Date(e.date) <= instant);
    const etats = skills.map((s) => computeSkillState(s, jusque, instant));
    const global = calculerEtatGlobal(etats, instant, domaines);

    sorties.push({
      date: instant.toISOString(),
      scoreGlobal: global.scoreGlobal,
      competencesEvaluees: global.competencesEvaluees,
      nombrePreuves: jusque.length,
      parDomaine: new Map(global.parDomaine.map((d) => [d.domaine, d.score])),
    });
  }

  // Toujours terminer sur l'instant présent.
  if (sorties.at(-1) && joursDepuis(sorties.at(-1)!.date, now) > 0) {
    const etats = skills.map((s) => computeSkillState(s, triees, now));
    const global = calculerEtatGlobal(etats, now, domaines);
    sorties.push({
      date: now.toISOString(),
      scoreGlobal: global.scoreGlobal,
      competencesEvaluees: global.competencesEvaluees,
      nombrePreuves: triees.length,
      parDomaine: new Map(global.parDomaine.map((d) => [d.domaine, d.score])),
    });
  }

  return sorties;
}

/* ------------------------------------------------------------------ */
/* Activité                                                            */
/* ------------------------------------------------------------------ */

export interface Activite {
  minutesParJour: Map<string, number>;
  joursActifs30: number;
  minutes30: number;
  seances30: number;
  minutesTotal: number;
  /** Dernière séance enregistrée, ou `null`. */
  derniereSeance: string | null;
}

/** Activité mesurée sur une fenêtre glissante de N jours. */
export interface ActiviteFenetre {
  joursActifs: number;
  minutes: number;
  seances: number;
}

/**
 * Activité sur les `jours` derniers jours.
 *
 * Extrait de `calculerActivite`, dont la fenêtre était figée à 30 jours : un
 * écran filtré par période a besoin de la même mesure sur sa propre fenêtre.
 * Aucun seuil n'est déplacé — `calculerActivite` appelle cette fonction avec
 * `30` et produit exactement ce qu'elle produisait.
 *
 * Une séance sans durée enregistrée compte pour 0 minute mais reste un jour
 * actif : ne pas noter sa durée n'est pas ne pas avoir travaillé.
 */
export function activiteSurFenetre(
  sessions: LearningSession[],
  jours: number,
  now: Date = new Date(),
): ActiviteFenetre {
  const dansLaFenetre = sessions
    .filter(seanceALieu)
    .filter((s) => joursDepuis(s.date, now) <= jours);
  return {
    joursActifs: new Set(dansLaFenetre.map((s) => cleJour(s.date))).size,
    minutes: dansLaFenetre.reduce((total, s) => total + (s.dureeMin ?? 0), 0),
    seances: dansLaFenetre.length,
  };
}

/**
 * Régularité de travail, présentée de façon descriptive.
 *
 * Aucun compteur de série consécutive : le cahier des charges exclut
 * explicitement le streak agressif et la culpabilisation. On mesure des
 * jours actifs et du temps investi, pas une chaîne à ne pas rompre.
 */
export function calculerActivite(
  sessions: LearningSession[],
  now: Date = new Date(),
): Activite {
  /*
   * Le filtre est en tête, et il n'est pas un détail d'implémentation.
   *
   * Une séance PLANIFIÉE n'a pas eu lieu (ADR-048). La compter remplirait une
   * case du bandeau d'activité pour une intention, ce qui est exactement le 0
   * fabriqué à l'envers : une mesure là où il n'y a rien de mesuré (P2). Et
   * `derniereSeance` pointerait vers une date future.
   *
   * `seanceALieu` vit dans le domaine parce que les deux fonctions de ce fichier
   * posent la même question, et qu'un troisième appelant viendra.
   */
  const eues = sessions.filter(seanceALieu);

  const minutesParJour = new Map<string, number>();
  for (const s of eues) {
    const cle = cleJour(s.date);
    minutesParJour.set(cle, (minutesParJour.get(cle) ?? 0) + (s.dureeMin ?? 0));
  }

  const recente = activiteSurFenetre(eues, 30, now);
  const triees = [...eues].sort((a, b) => a.date.localeCompare(b.date));

  return {
    minutesParJour,
    joursActifs30: recente.joursActifs,
    minutes30: recente.minutes,
    seances30: recente.seances,
    minutesTotal: eues.reduce((s, x) => s + (x.dureeMin ?? 0), 0),
    derniereSeance: triees.at(-1)?.date ?? null,
  };
}
