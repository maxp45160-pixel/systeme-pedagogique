/**
 * Ce qu'un travail terminé vient d'ajouter.
 *
 * ## Le défaut que ce module corrige
 *
 * La fin d'un exercice affichait « Observation enregistrée — DEV-01 : niveau 3/5,
 * confiance moyenne ». Deux nombres, pris à l'instant, sans dire **ce qu'ils
 * étaient avant**. La personne venait de travailler quarante minutes et ne
 * pouvait pas savoir si quelque chose avait bougé.
 *
 * Tout ce qu'il faut pour le dire existait déjà : `evenementsRecents` calcule
 * le niveau avant et après une observation par rejeu du journal, `calibrer` connaît
 * la dimension la plus faible, et le verdict du tuteur est archivé depuis
 * ADR-046. Aucun de ces trois n'était lu à cet endroit.
 *
 * ## Ce que ce module n'est pas
 *
 * **Rien n'est stocké.** L'impact est recalculé à chaque lecture depuis les
 * observations — c'est P1, et c'est aussi ce qui garantit qu'un impact affiché
 * correspond toujours au journal présent : il ne peut pas dériver.
 *
 * **Aucune phrase n'est écrite par le tuteur.** Chaque ligne rendue ici est
 * dérivée d'une valeur que le moteur a produite, et cite ce qui la fonde (P3).
 * Le tuteur ne mesure pas (P5) ; ce qu'il avait écrit au moment du bilan est
 * repris tel quel, à part, comme un commentaire — jamais comme une conclusion.
 *
 * **Ce module ne juge pas la personne.** Une observation qui ne déplace aucun niveau
 * n'est pas un échec : elle confirme. Le dire explicitement vaut mieux que de
 * n'afficher que les franchissements, qui donneraient l'illusion d'une courbe
 * toujours montante — même raison qu'`evenementsRecents`.
 */

import type {
  Confiance,
  Dimension,
  Difficulte,
  Exercise,
  ExerciseAttempt,
  NiveauCompetence,
  NiveauObservation,
  Skill,
  SkillObservation,
  SkillState,
} from "@/lib/domain/types";
import { AUTONOMIE, LIBELLES_DIMENSIONS, NIVEAUX } from "@/lib/domain/types";
import type { Calibration } from "./calibration";
import { difficulteVisee, recommander } from "./recommend";
import { computeSkillState } from "./skill-state";
import { cleContexte } from "./contexte-situation";

/** Rang de confiance, pour dire si elle a monté ou baissé. */
const RANG_CONFIANCE: Record<Confiance, number> = {
  nulle: 0,
  faible: 1,
  moyenne: 2,
  forte: 3,
};

export interface CompetenceRenforcee {
  code: string;
  intitule: string;
  niveauAvant: NiveauCompetence | null;
  niveauApres: NiveauCompetence | null;
  /** Vrai si cette observation a fait franchir un palier. */
  franchissement: boolean;
  confianceAvant: Confiance;
  confianceApres: Confiance;
  /** A pour la compétence principale de l'exercice, B pour les autres. */
  niveauObservation: NiveauObservation;
  /** Vrai si cette observation inaugure un contexte que la compétence n'avait pas. */
  nouveauContexte: boolean;
  /** Nombre d'observations après celle-ci — dit combien pèse le total. */
  nombreObservations: number;
}

export interface ImpactTravail {
  travail: {
    titre: string;
    dureeMin: number | null;
    difficulte: number;
    resultat: ExerciseAttempt["resultat"];
    indicesUtilises: number;
  };
  /** Les compétences que cette tentative a fait bouger, cible principale en tête. */
  renforcees: CompetenceRenforcee[];
  /** Ce qui a été observé pendant le travail. Constats, pas conseils. */
  observations: string[];
  /** Ce que le journal dit de différent après ce travail. */
  consequences: string[];
  /**
   * Ce que l'évaluation ne peut PAS encore affirmer — dérivé des mêmes états
   * que les conséquences, jamais rédigé d'avance. Vide quand rien ne manque.
   */
  reserves: string[];
  /** Ce que le tuteur avait écrit au moment du bilan, repris mot pour mot. */
  aRetravailler: string[];
}

export interface EntreesImpact {
  exercice: Exercise;
  tentative: ExerciseAttempt;
  /** Le journal complet du compte. Le module y retrouve seul ce qui appartient à cette tentative. */
  observations: readonly SkillObservation[];
  /** Tout le référentiel, archivées comprises : une observation ancienne doit rester lisible (P4). */
  skillsParCode: ReadonlyMap<string, Skill>;
  calibrations?: ReadonlyMap<string, Calibration>;
  now?: Date;
}

/**
 * Les observations écrites par cette tentative.
 *
 * `terminerExercice` horodate la tentative et ses observations avec **la même**
 * chaîne ISO, produite une seule fois. C'est cette égalité qui les rattache,
 * et non `source.ref` — qui porte l'identifiant de l'exercice, donc désigne
 * aussi les tentatives précédentes du même exercice (ADR-066, amendement du
 * 14/08 : « `observations.source.ref` reste l'identifiant de l'exercice »).
 *
 * Le filtre sur `source.ref` reste, en second : deux gestes distincts pourraient
 * théoriquement partager la milliseconde, et on préfère rendre trop peu que
 * d'attribuer à ce travail une observation qu'il n'a pas produite.
 */
function observationsDeLaTentative(
  observations: readonly SkillObservation[],
  exercice: Exercise,
  tentative: ExerciseAttempt,
): SkillObservation[] {
  if (!tentative.fin) return [];
  return observations.filter(
    (observation) =>
      observation.date === tentative.fin &&
      observation.source.kind === "exercice" &&
      observation.source.ref === exercice.id,
  );
}

/**
 * L'état d'une compétence juste avant et juste après une observation donnée.
 *
 * Même technique qu'`evenementsRecents` : `computeSkillState` filtre déjà sur
 * `skillCode`, donc l'historique tronqué au rang de l'observation **est** l'état
 * d'alors. Rien n'est stocké ; on rejoue.
 */
function avantApres(
  skill: Skill,
  observation: SkillObservation,
  observations: readonly SkillObservation[],
  now: Date,
) {
  const historique = observations
    .filter((item) => item.skillCode === skill.code)
    .sort((a, b) => a.date.localeCompare(b.date));
  const rang = historique.findIndex((item) => item.id === observation.id);
  // Observation absente du journal fourni : on ne fabrique pas d'état « avant ».
  const coupe = rang === -1 ? historique.length : rang;
  return {
    avant: computeSkillState(skill, historique.slice(0, coupe), now),
    apres: computeSkillState(skill, historique.slice(0, coupe + 1), now),
    total: coupe + 1,
  };
}

function libelleDimension(dimension: Dimension): string {
  return LIBELLES_DIMENSIONS[dimension];
}

/** Un nombre de 0 à 1 rendu en français, sans faux zéro décimal. */
function part(valeur: number): string {
  return valeur.toFixed(2).replace(".", ",");
}

/**
 * Ce que cette tentative a changé.
 *
 * Rend `null` quand elle n'a produit aucune observation — une tentative abandonnée,
 * typiquement. C'est volontaire : « absence de mesure n'est pas un zéro » (P2)
 * s'applique aussi à l'affichage. Un écran d'impact vide serait moins honnête
 * que pas d'écran du tout, et l'abandon a déjà son propre message.
 */
export function impactTentative(entrees: EntreesImpact): ImpactTravail | null {
  const { exercice, tentative, observations, skillsParCode, calibrations } = entrees;
  const now = entrees.now ?? new Date();

  if (tentative.statut !== "terminee") return null;
  const produites = observationsDeLaTentative(observations, exercice, tentative);
  if (produites.length === 0) return null;

  /*
   * L'ordre suit celui de l'exercice, pas celui du journal : la cible
   * principale doit rester en tête, c'est elle qui porte l'observation directe.
   */
  const rangCible = new Map(exercice.competences.map((code, index) => [code, index]));
  const triees = [...produites].sort(
    (a, b) =>
      (rangCible.get(a.skillCode) ?? Number.MAX_SAFE_INTEGER) -
      (rangCible.get(b.skillCode) ?? Number.MAX_SAFE_INTEGER),
  );

  const renforcees: CompetenceRenforcee[] = [];
  const consequences: string[] = [];

  for (const observation of triees) {
    const skill = skillsParCode.get(observation.skillCode);
    if (!skill) continue;

    const { avant, apres, total } = avantApres(skill, observation, observations, now);
    // Une FAMILLE de situation encore jamais vue, pas un titre inédit
    // (ADR-083) : `contextesTestes` porte des clés de famille depuis le
    // 18/08/2026, et comparer un libellé brut aurait rendu ce drapeau
    // systématiquement vrai.
    const nouveauContexte = !avant.contextesTestes.includes(cleContexte(observation));

    renforcees.push({
      code: skill.code,
      intitule: skill.intitule,
      niveauAvant: avant.niveau,
      niveauApres: apres.niveau,
      franchissement: avant.niveau !== apres.niveau,
      confianceAvant: avant.confiance,
      confianceApres: apres.confiance,
      niveauObservation: observation.niveauObservation,
      nouveauContexte,
      nombreObservations: total,
    });

    /* ---- Ce que le journal dit de différent, compétence par compétence ---- */

    if (avant.niveau === null && apres.niveau !== null) {
      consequences.push(
        `${skill.intitule} est mesurée pour la première fois : niveau ${apres.niveau} — ${NIVEAUX[apres.niveau].nom}.`,
      );
    } else if (avant.niveau !== null && apres.niveau !== null && avant.niveau !== apres.niveau) {
      const sens = apres.niveau > avant.niveau ? "passe" : "redescend";
      consequences.push(
        `${skill.intitule} ${sens} du niveau ${avant.niveau} au niveau ${apres.niveau} — ${NIVEAUX[apres.niveau].nom}.`,
      );
    } else if (apres.niveau !== null) {
      consequences.push(
        `${skill.intitule} reste au niveau ${apres.niveau} : cette observation le confirme sans le déplacer.`,
      );
    }

    const ecartConfiance = RANG_CONFIANCE[apres.confiance] - RANG_CONFIANCE[avant.confiance];
    if (ecartConfiance > 0) {
      consequences.push(
        `La confiance sur ${skill.code} passe de « ${avant.confiance} » à « ${apres.confiance} » — ${total} observation${total > 1 ? "s" : ""} au total.`,
      );
    } else if (ecartConfiance < 0) {
      consequences.push(
        `La confiance sur ${skill.code} redescend de « ${avant.confiance} » à « ${apres.confiance} » : les observations ne concordent pas encore.`,
      );
    }

    /*
     * Une contradiction est une information, pas une faute. Elle apparaît
     * quand une observation s'oppose à la tendance dominante — la taire donnerait un
     * état plus lisse que ce que le journal contient réellement (§5 du
     * protocole d'évaluation).
     */
    if (apres.contradictions.length > avant.contradictions.length) {
      consequences.push(
        `Ce résultat s'oppose aux précédents sur ${skill.code} : le niveau affiché en tient compte, la confiance aussi.`,
      );
    }
  }

  /* ---- Ce qui a été observé pendant le travail ---- */

  const faitsObserves: string[] = [];
  const principale = triees[0];

  if (principale) {
    const autonomie = AUTONOMIE[principale.autonomie];
    faitsObserves.push(
      tentative.indicesUtilises === 0
        ? `Autonomie ${principale.autonomie} — ${autonomie.libelle.toLowerCase()}, aucun indice consulté.`
        : `Autonomie ${principale.autonomie} — ${autonomie.libelle.toLowerCase()}, ${tentative.indicesUtilises} indice${tentative.indicesUtilises > 1 ? "s" : ""} consulté${tentative.indicesUtilises > 1 ? "s" : ""}.`,
    );
  }

  const nouveaux = renforcees.filter((item) => item.nouveauContexte);
  if (nouveaux.length > 0) {
    faitsObserves.push(
      `Contexte nouveau pour ${nouveaux.map((item) => item.code).join(", ")} : c'est la variété des contextes qui atteste un transfert, pas leur nombre.`,
    );
  }

  /*
   * La dimension la plus faible vient de la calibration, qui la calcule sur
   * plusieurs tentatives. Elle porte son propre nombre d'observations : une
   * seule tentative reste une information, avec sa réserve — on la dit plutôt
   * que de la présenter comme une tendance établie.
   */
  const calibration = principale ? calibrations?.get(principale.skillCode) : undefined;
  const faible = calibration?.dimensionFaible;
  if (faible) {
    faitsObserves.push(
      faible.observations >= 2
        ? `${libelleDimension(faible.dimension)} reste ton point bas sur ${calibration!.skillCode} : ${part(faible.moyenne)} sur ${faible.observations} tentatives.`
        : `${libelleDimension(faible.dimension)} est la dimension la plus basse de cette tentative (${part(faible.moyenne)}) — une seule observation, à confirmer.`,
    );
  }

  const bilan = tentative.verdictTuteur?.bilan;
  if (bilan?.pointsBloquants.trim()) {
    faitsObserves.push(bilan.pointsBloquants.trim());
  }

  return {
    travail: {
      titre: exercice.titre,
      dureeMin: tentative.dureeMin ?? null,
      difficulte: exercice.difficulte,
      resultat: tentative.resultat,
      indicesUtilises: tentative.indicesUtilises,
    },
    renforcees,
    observations: faitsObserves,
    consequences,
    reserves: reservesEvaluation(renforcees),
    aRetravailler: bilan?.aRetravailler.filter((ligne) => ligne.trim().length > 0) ?? [],
  };
}

/**
 * Les réserves de l'évaluation, dérivées des états d'après-travail.
 *
 * Trois sources, chacune citée : une mesure portée uniquement par des
 * observations indirectes, une première mesure unique, une confiance qui
 * n'a pas encore de matière. Une évaluation solide ne produit AUCUNE réserve —
 * le doute cosmétique serait un autre mensonge. Pur : rien n'est stocké (P1),
 * la même fonction rendra le même verdict tant que le journal ne bouge pas.
 */
export function reservesEvaluation(
  renforcees: readonly CompetenceRenforcee[],
): string[] {
  const reserves: string[] = [];
  if (renforcees.length === 0) return reserves;

  if (renforcees.every((competence) => competence.niveauObservation === "B")) {
    reserves.push(
      `Mesure indirecte : ce travail éclaire ${renforcees.map((c) => c.code).join(", ")} sans viser sa compétence cible de front — à confirmer par un exercice direct.`,
    );
  }

  const principale = renforcees[0];
  if (principale.nombreObservations === 1) {
    reserves.push(
      `Première mesure sur ${principale.code} : une seule observation ne suffit pas à établir une maîtrise.`,
    );
  } else if (
    principale.confianceApres === "faible" ||
    principale.confianceApres === "nulle"
  ) {
    reserves.push(
      `La confiance sur ${principale.code} reste « ${principale.confianceApres} » après ${principale.nombreObservations} observation${principale.nombreObservations > 1 ? "s" : ""} : trop peu de concordance pour trancher.`,
    );
  }

  return reserves;
}

/** Ce que le moteur propose d'enchaîner, une fois ce travail refermé. */
export interface SuiteTravail {
  /** Un autre exercice recommandable pour cette compétence, s'il en reste un. */
  exerciceSuivant: { id: string; titre: string; difficulte: number } | null;
  /** La difficulté à viser ensuite — calibration comprise (ADR-028). */
  difficulteConseillee: Difficulte;
}

/**
 * L'effet du travail sur la prochaine action.
 *
 * Réutilise LE moteur, jamais une copie : `recommander` borné à la compétence
 * travaillée choisit l'exercice suivant selon les règles existantes (exercice
 * déjà réussi sorti, échec sévère en attente de progrès — tout ce qui vient
 * d'être observé compris), et `difficulteVisee` porte la calibration. Rien
 * d'inventé : quand plus rien n'est recommandable, c'est dit, et l'appelant
 * propose le chemin de génération, pas un faux exercice.
 */
export function suiteApresTravail(entrees: {
  etatApres: SkillState;
  calibrations?: ReadonlyMap<string, Calibration>;
  exercices: readonly Exercise[];
  tentatives: readonly ExerciseAttempt[];
  now?: Date;
  /** Exclusion déterministe du ou des exercices déjà traversés dans ce parcours. */
  exercicesExclus?: ReadonlySet<string>;
}): SuiteTravail {
  const now = entrees.now ?? new Date();
  const calibrations = entrees.calibrations ? new Map(entrees.calibrations) : undefined;
  const [rec] = recommander(
    [entrees.etatApres],
    [...entrees.exercices],
    [...entrees.tentatives],
    1,
    calibrations,
    now,
    undefined,
    undefined,
    undefined,
    undefined,
    entrees.exercicesExclus,
  );
  return {
    exerciceSuivant: rec?.exercice
      ? {
          id: rec.exercice.id,
          titre: rec.exercice.titre,
          difficulte: rec.exercice.difficulte,
        }
      : null,
    difficulteConseillee: difficulteVisee(entrees.etatApres, calibrations?.get(entrees.etatApres.skill.code)),
  };
}

/**
 * L'impact cumulé de plusieurs tentatives — une séance, typiquement.
 *
 * Les compétences sont fusionnées : `niveauAvant` est celui de la **première**
 * tentative qui l'a touchée, `niveauApres` celui de la dernière. Une compétence
 * travaillée deux fois dans la même séance doit apparaître une fois, avec
 * l'écart réel du début à la fin — pas deux fois avec deux demi-écarts.
 */
export function impactCumule(impacts: readonly ImpactTravail[]): {
  renforcees: CompetenceRenforcee[];
  observations: string[];
  consequences: string[];
  dureeMin: number;
} {
  const parCode = new Map<string, CompetenceRenforcee>();
  for (const impact of impacts) {
    for (const item of impact.renforcees) {
      const deja = parCode.get(item.code);
      if (!deja) {
        parCode.set(item.code, { ...item });
        continue;
      }
      parCode.set(item.code, {
        ...item,
        niveauAvant: deja.niveauAvant,
        confianceAvant: deja.confianceAvant,
        franchissement: deja.niveauAvant !== item.niveauApres,
        // Une observation directe l'emporte : la compétence a bien été visée de front
        // au moins une fois dans la séance.
        niveauObservation: deja.niveauObservation === "A" || item.niveauObservation === "A" ? "A" : item.niveauObservation,
        nouveauContexte: deja.nouveauContexte || item.nouveauContexte,
      });
    }
  }

  return {
    renforcees: [...parCode.values()],
    observations: [...new Set(impacts.flatMap((impact) => impact.observations))],
    consequences: [...new Set(impacts.flatMap((impact) => impact.consequences))],
    dureeMin: impacts.reduce((total, impact) => total + (impact.travail.dureeMin ?? 0), 0),
  };
}
