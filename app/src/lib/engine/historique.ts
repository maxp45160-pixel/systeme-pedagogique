/**
 * Reconstitution de l'historique par rejeu du journal.
 *
 * Aucune progression n'est stockée : pour savoir qu'une compétence est passée
 * du niveau 2 au niveau 3, on recalcule son état avant et après l'observation
 * concernée. C'est plus coûteux qu'un champ « niveau précédent », mais cela
 * garantit qu'un historique affiché correspond toujours aux observations présentes
 * — il ne peut pas dériver.
 */

import type {
  DomaineId,
  ExerciseAttempt,
  LearningSession,
  NiveauCompetence,
  Skill,
  SkillObservation,
} from "@/lib/domain/types";
import { seanceALieu, tentativeDeSeance } from "@/lib/domain/seance";
import { dureeRetenue } from "@/lib/domain/tentative";
import { computeSkillState } from "./skill-state";
import { estMaitrisee } from "./maitrise";
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
  /** Vrai si cette observation a fait franchir un palier. */
  franchissement: boolean;
  resultat: SkillObservation["resultat"];
  type: SkillObservation["type"];
  contexte: string;
  commentaire?: string;
}

/**
 * Liste les observations les plus récentes en indiquant leur effet réel sur le
 * niveau. Une observation qui ne change rien est conservée dans la liste : le
 * travail sans franchissement de palier est une information utile, pas un
 * échec à masquer.
 */
export function evenementsRecents(
  observations: SkillObservation[],
  // `ReadonlyMap` : cette fonction ne fait que lire le référentiel, et
  // l'exiger mutable obligeait ses appelants à en recopier un.
  skillsParCode: ReadonlyMap<string, Skill>,
  limite = 8,
  now: Date = new Date(),
): EvenementProgression[] {
  const triees = [...observations].sort((a, b) => a.date.localeCompare(b.date));

  // `computeSkillState` commence par filtrer sur `skillCode` : l'état « avant »
  // calculé sur `triees.slice(0, i)` vaut donc exactement l'état calculé sur le
  // seul historique de cette compétence, tronqué au rang qu'y occupe l'observation.
  // On regroupe une fois par compétence en mémorisant ce rang, puis on ne dérive
  // que les `limite` observations réellement rendues.
  //
  // La version précédente dérivait les n observations — deux `computeSkillState` et
  // deux copies du tableau complet chacune — pour n'en garder que `limite` à la
  // dernière ligne. Sur le journal, qui ne fait que croître et demande 200
  // évènements, ce coût était quadratique.
  const parCode = new Map<string, SkillObservation[]>();
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
    const observation = triees[i];
    // `skillsParCode` doit couvrir TOUT le référentiel du compte, archivées
    // comprises — c'est `Referentiel.parCode`, pas `actifs`. Une compétence
    // sortie du périmètre garde ses observations, et son historique doit rester
    // lisible (P4).
    const skill = skillsParCode.get(observation.skillCode);
    // Observation hors référentiel : ignorée sans consommer de place dans la liste.
    // Depuis ADR-027 la clé étrangère `observations_competence_fk` rend ce cas
    // impossible en base ; le garde reste pour les journaux importés et les
    // tests.
    if (!skill) continue;

    const historique = parCode.get(observation.skillCode)!;
    const rang = rangDansSaCompetence[i];
    const avant = computeSkillState(skill, historique.slice(0, rang), now);
    const apres = computeSkillState(skill, historique.slice(0, rang + 1), now);

    evenements.push({
      date: observation.date,
      skillCode: observation.skillCode,
      intitule: skill.intitule,
      domaine: skill.domaine,
      niveauAvant: avant.niveau,
      niveauApres: apres.niveau,
      franchissement: avant.niveau !== apres.niveau,
      resultat: observation.resultat,
      type: observation.type,
      contexte: observation.contexte,
      commentaire: observation.commentaire,
    });
  }

  // Déjà du plus récent au plus ancien : le parcours part de la fin.
  return evenements;
}

export interface FranchissementMaitrise {
  code: string;
  intitule: string;
  franchiLe: string;
}

/**
 * Retrouve le dernier passage faux → vrai des compétences encore maîtrisées.
 *
 * La date n'est pas stockée : elle se reconstitue par rejeu, comme les paliers
 * du journal. Une régression retire donc à la fois la maîtrise et le droit de
 * pousser une proposition qui s'appuyait dessus.
 */
export function franchissementsMaitriseCourants(
  observations: readonly SkillObservation[],
  skillsParCode: ReadonlyMap<string, Skill>,
  now: Date = new Date(),
): FranchissementMaitrise[] {
  const parCode = new Map<string, SkillObservation[]>();
  for (const observation of [...observations].sort((a, b) => a.date.localeCompare(b.date))) {
    const historique = parCode.get(observation.skillCode) ?? [];
    historique.push(observation);
    parCode.set(observation.skillCode, historique);
  }

  const passages: FranchissementMaitrise[] = [];
  for (const [code, historique] of parCode) {
    const skill = skillsParCode.get(code);
    if (!skill || skill.archive) continue;
    const courant = computeSkillState(skill, historique, now);
    if (!estMaitrisee(courant)) continue;

    let franchiLe: string | null = null;
    for (let rang = 0; rang < historique.length; rang++) {
      const avant = computeSkillState(skill, historique.slice(0, rang), now);
      const apres = computeSkillState(skill, historique.slice(0, rang + 1), now);
      if (!estMaitrisee(avant) && estMaitrisee(apres)) franchiLe = historique[rang].date;
    }
    if (franchiLe) passages.push({ code, intitule: skill.intitule, franchiLe });
  }

  return passages.sort((a, b) => b.franchiLe.localeCompare(a.franchiLe));
}

/* ------------------------------------------------------------------ */
/* Photographies périodiques                                           */
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

interface TraceActivite {
  sessionId: string;
  date: string;
  dureeMin?: number;
}

/**
 * Répartit le temps observé au jour de la tentative, quand la source est
 * disponible. Les séances historiques sans tentative correspondante gardent
 * leur ligne de repli : on ne réécrit pas le passé par absence de donnée.
 *
 * ⚠️ La durée d'une tentative passe par `dureeRetenue` (ADR-071), jamais par
 * `tentative.dureeMin` brut. `dureeMin` est du temps d'horloge : un exercice
 * laissé ouvert une nuit puis abandonné valait 1015 minutes, et l'activité les
 * comptait comme du travail. Le plafond s'applique ici en plus de l'écriture
 * parce que les lignes déjà en base, elles, portent la valeur brute.
 *
 * `dureesEstimees` est une table `id → dureeEstimeeMin`, pas une liste
 * d'exercices, et la distinction porte : elle doit couvrir tout ce qui a été
 * tenté un jour — diagnostics compris, exercices sortis du périmètre compris —
 * là où une liste d'exercices est toujours filtrée pour un écran. Le moteur ne
 * reçoit ainsi que la mesure dont il a besoin, jamais le référentiel.
 */
/**
 * La reconstruction du temps travaillé, trace par trace — l'AUTORITÉ unique de
 * la durée retenue.
 *
 * Publiée depuis le 25/08/2026 pour que la carrière (`resumeCarriere`) somme
 * exactement ce que somme le bilan de croissance et `calculerActivite` : trois
 * panneaux qui parlaient du même travail devaient lire la même reconstruction,
 * sans quoi « Temps travaillé » divergeait d'une carte à l'autre. Toute nouvelle
 * lecture du temps retenu passe par ici, jamais par une somme brute de
 * `session.dureeMin`.
 */
export function tracesActivite(
  sessions: LearningSession[],
  tentatives: ExerciseAttempt[] = [],
  dureesEstimees: Map<string, number> = new Map(),
): TraceActivite[] {
  const duree = (tentative: ExerciseAttempt) =>
    dureeRetenue(tentative, dureesEstimees.get(tentative.exerciseId));

  return sessions.filter(seanceALieu).flatMap((seance) => {
    const exercices = new Set(
      seance.activites
        .filter((activite) => activite.type === "exercice")
        .map((activite) => activite.ref),
    );
    const candidates = tentatives.filter(
      (tentative) =>
        exercices.has(tentative.exerciseId) &&
        (seance.genereAutomatiquement || tentative.debut >= seance.date),
    );

    if (tentatives.length === 0 || candidates.length === 0) {
      return [{ sessionId: seance.id, date: seance.date, dureeMin: seance.dureeMin }];
    }

    // Une ancienne séance mono-exercice était écrite au même geste que sa
    // tentative. `tentativeDeSeance` évite qu'un exercice refait plus tard ne
    // déplace rétroactivement cette ligne historique.
    if (seance.genereAutomatiquement) {
      const exercice = [...exercices][0];
      const tentative = exercice ? tentativeDeSeance(seance, exercice, tentatives) : undefined;
      return tentative
        ? [{ sessionId: seance.id, date: tentative.fin ?? tentative.debut, dureeMin: duree(tentative) ?? seance.dureeMin }]
        : [{ sessionId: seance.id, date: seance.date, dureeMin: seance.dureeMin }];
    }

    return candidates.map((tentative) => ({
      sessionId: seance.id,
      date: tentative.fin ?? tentative.debut,
      dureeMin: duree(tentative),
    }));
  });
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
  tentatives: ExerciseAttempt[] = [],
  dureesEstimees: Map<string, number> = new Map(),
): ActiviteFenetre {
  const dansLaFenetre = tracesActivite(sessions, tentatives, dureesEstimees)
    .filter((trace) => joursDepuis(trace.date, now) <= jours);
  return {
    joursActifs: new Set(dansLaFenetre.map((trace) => cleJour(trace.date))).size,
    minutes: dansLaFenetre.reduce((total, trace) => total + (trace.dureeMin ?? 0), 0),
    seances: new Set(dansLaFenetre.map((trace) => trace.sessionId)).size,
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
  tentatives: ExerciseAttempt[] = [],
  dureesEstimees: Map<string, number> = new Map(),
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
  const traces = tracesActivite(eues, tentatives, dureesEstimees);

  const minutesParJour = new Map<string, number>();
  for (const trace of traces) {
    const cle = cleJour(trace.date);
    minutesParJour.set(cle, (minutesParJour.get(cle) ?? 0) + (trace.dureeMin ?? 0));
  }

  const recente = activiteSurFenetre(eues, 30, now, tentatives, dureesEstimees);
  const triees = [...traces].sort((a, b) => a.date.localeCompare(b.date));

  return {
    minutesParJour,
    joursActifs30: recente.joursActifs,
    minutes30: recente.minutes,
    seances30: recente.seances,
    minutesTotal: traces.reduce((total, trace) => total + (trace.dureeMin ?? 0), 0),
    derniereSeance: triees.at(-1)?.date ?? null,
  };
}
