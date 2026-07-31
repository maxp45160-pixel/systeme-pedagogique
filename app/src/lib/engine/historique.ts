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
  DomaineId,
  LearningSession,
  NiveauCompetence,
  Skill,
  SkillEvidence,
} from "@/lib/domain/types";
import { SKILL_PAR_CODE } from "@/lib/domain/referentiel";
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
    const skill = SKILL_PAR_CODE.get(preuve.skillCode);
    // Preuve hors référentiel : ignorée sans consommer de place dans la liste,
    // comme lorsque le filtrage précédait le `slice(0, limite)`.
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
): Photographie[] {
  const triees = [...preuves].sort((a, b) => a.date.localeCompare(b.date));
  const sorties: Photographie[] = [];

  for (let d = jours; d >= 0; d -= pas) {
    const instant = new Date(now.getTime() - d * JOUR_MS);
    const jusque = triees.filter((e) => new Date(e.date) <= instant);
    const etats = skills.map((s) => computeSkillState(s, jusque, instant));
    const global = calculerEtatGlobal(etats, instant);

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
    const global = calculerEtatGlobal(etats, now);
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
  const minutesParJour = new Map<string, number>();
  for (const s of sessions) {
    const cle = cleJour(s.date);
    // Une séance sans durée enregistrée compte pour 0 minute, mais reste un
    // jour actif (elle est comptée via joursRecents plus bas).
    minutesParJour.set(cle, (minutesParJour.get(cle) ?? 0) + (s.dureeMin ?? 0));
  }

  const recentes = sessions.filter((s) => joursDepuis(s.date, now) <= 30);
  const joursRecents = new Set(recentes.map((s) => cleJour(s.date)));
  const triees = [...sessions].sort((a, b) => a.date.localeCompare(b.date));

  return {
    minutesParJour,
    joursActifs30: joursRecents.size,
    minutes30: recentes.reduce((s, x) => s + (x.dureeMin ?? 0), 0),
    seances30: recentes.length,
    minutesTotal: sessions.reduce((s, x) => s + (x.dureeMin ?? 0), 0),
    derniereSeance: triees.at(-1)?.date ?? null,
  };
}
