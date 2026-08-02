/**
 * 3ᵉ maillon de la boucle — l'ajustement des exercices (ADR-028).
 *
 * La boucle du produit est : génération → évaluation → **ajustement**. Les deux
 * premiers maillons fonctionnent ; le troisième n'existait pas. Ce n'était pas
 * « on ne peut pas modifier un exercice » — `difficulte` est une colonne
 * éditable — mais que **rien ne relisait la mesure pour régler la génération
 * suivante**. `indicesUtilises`, `dureeMin`, `resultat` et `autoEvaluation`
 * étaient écrits et jamais réexploités.
 *
 * Ce module dérive, pour chaque compétence, deux choses que le tuteur et le
 * moteur de recommandation peuvent utiliser :
 *
 *   1. une DIFFICULTÉ CONSEILLÉE, du résultat × indices × durée observés ;
 *   2. une DIMENSION FAIBLE, de l'auto-évaluation par critère.
 *
 * Le second axe est le plus important, et le moins évident. `diag-dev-03` a été
 * échoué avec « comprehension 0.5, application 0 » : la difficulté n'est pas le
 * problème, l'angle l'est. Proposer le même exercice « en plus facile » raterait
 * ce que la mesure dit réellement. C'est ce qu'`ErrorItem` devait capturer et
 * n'a jamais capturé, faute d'être dérivé (ADR-014, réserve inscrite).
 *
 * RIEN N'EST STOCKÉ (P1) : tout se recalcule à la lecture, comme les niveaux.
 * L'entité `ErrorItem` est restée vide précisément parce qu'elle demandait une
 * saisie manuelle.
 */

import type {
  Dimension,
  Difficulte,
  Exercise,
  ExerciseAttempt,
  Explication,
  Skill,
  SkillState,
} from "@/lib/domain/types";
import { LIBELLES_DIMENSIONS } from "@/lib/domain/types";

/* ------------------------------------------------------------------ */
/* Seuils — chacun justifié par une observation, pas par une intuition */
/* ------------------------------------------------------------------ */

/**
 * En deçà de cette fraction de la durée estimée, aucune conclusion sur la
 * difficulté n'est tirée.
 *
 * Observé le 31/07/2026 : `diag-algo-01`, difficulté 2 estimée à 25 min, a été
 * « échoué » en **1 minute** avec les trois indices consultés. Conclure « trop
 * difficile » de cela serait inventer — l'exercice n'a pas été tenté. Même
 * forme pour `diag-sysc-01` (7 min sur 40, sans indice).
 *
 * C'est la règle qui empêche le 3ᵉ maillon de dire plus que ce qu'il mesure
 * (anti-hallucination §7).
 */
export const FRACTION_NON_TENTEE = 0.25;

/**
 * Réussi sans aucun indice en deçà de cette fraction du temps estimé : l'exercice
 * n'a pas résisté.
 *
 * Calé sur les données réelles : `diag-dev-05` (12 min sur 25) et `diag-prod-01`
 * (14 min sur 35) sont manifestement sous le niveau ; `diag-prod-03` (32 sur 35)
 * et `diag-ro-01` (61 sur 35) ne le sont pas. Le seuil sépare exactement ces
 * deux groupes.
 */
export const FRACTION_TROP_FACILE = 0.6;

/** Fenêtre d'observation. Au-delà, la calibration suivrait un passé révolu. */
export const TENTATIVES_RETENUES = 3;

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type SignalCalibration = "trop-facile" | "calibre" | "trop-difficile" | "non-tentee";

export interface VerdictTentative {
  exerciceId: string;
  titre: string;
  difficulte: Difficulte;
  signal: SignalCalibration;
  /** Phrase citant les valeurs observées — jamais un texte rédigé d'avance (P3). */
  raison: string;
  date: string;
}

export interface DimensionFaible {
  dimension: Dimension;
  /** Moyenne observée, de 0 à 1. */
  moyenne: number;
  /** Sur combien de tentatives — une seule reste une information, avec sa réserve. */
  observations: number;
}

export interface Calibration {
  skillCode: string;
  /**
   * Difficulté à viser pour le prochain exercice, **dérivée des tentatives**.
   * `null` quand aucune tentative exploitable n'existe : l'appelant retombe
   * alors sur la table par niveau, et doit le dire.
   */
  difficulteConseillee: Difficulte | null;
  /** Signal de la dernière tentative exploitable. */
  signal: SignalCalibration | null;
  dimensionFaible: DimensionFaible | null;
  /** Du plus récent au plus ancien. Inclut les tentatives non exploitables. */
  verdicts: VerdictTentative[];
  explication: Explication;
}

/* ------------------------------------------------------------------ */
/* Verdict d'une tentative                                             */
/* ------------------------------------------------------------------ */

function borner(n: number): Difficulte {
  return Math.min(5, Math.max(1, Math.round(n))) as Difficulte;
}

/**
 * L'exercice a-t-il seulement été fait ?
 *
 * Une durée dérisoire au regard de l'estimation n'est pas un échec : c'est un
 * abandon, et on ne peut rien en conclure — ni sur la difficulté, ni sur le
 * niveau de la personne (anti-hallucination §7).
 *
 * Exception : une **réussite** échappe à la règle. On ne réussit pas un
 * exercice sans l'avoir fait, et une réussite éclair est au contraire le signal
 * le plus informatif du lot.
 *
 * ⚠️ Cette fonction porte la règle pour **deux** chemins qui doivent dire la
 * même chose : la calibration de la difficulté (`verdictTentative`, ci-dessous)
 * et l'écriture de la preuve (`terminerExercice`, `lib/store/actions.ts`). Le
 * second l'a longtemps ignorée : le 01/08/2026, une tentative abandonnée en
 * 1 minute sur 20 estimées a été enregistrée comme une preuve à toutes
 * dimensions nulles, faisant tomber DEV-01 de 2,7 à 2,3. Le garde-fou existait
 * ici et nulle part ailleurs ; « l'absence de mesure n'est pas un zéro » (P2)
 * était donc tenu pour la difficulté et rompu pour le journal de preuves.
 */
export function tentativeMenee(
  tentative: Pick<ExerciseAttempt, "resultat" | "dureeMin">,
  exercice: Pick<Exercise, "dureeEstimeeMin">,
): boolean {
  if (tentative.resultat === "reussi") return true;

  const estimee = exercice.dureeEstimeeMin;
  const reelle = tentative.dureeMin;
  // Sans durée estimée exploitable, aucune fraction n'a de sens : on ne peut
  // pas accuser la tentative de ne pas avoir eu lieu.
  if (!(estimee > 0) || reelle === undefined) return true;

  return reelle / estimee >= FRACTION_NON_TENTEE;
}

/**
 * Ce qu'une tentative dit du calibrage de l'exercice qui l'a produite.
 *
 * L'ordre des tests importe : la question « l'exercice a-t-il seulement été
 * tenté ? » précède toutes les autres. Un abandon rapide avec les indices
 * épuisés ressemble à un échec sur exercice trop dur, et n'en est pas un.
 */
export function verdictTentative(
  tentative: ExerciseAttempt,
  exercice: Exercise,
): VerdictTentative {
  const estimee = exercice.dureeEstimeeMin;
  const reelle = tentative.dureeMin;
  const fraction = estimee > 0 && reelle !== undefined ? reelle / estimee : null;
  const total = exercice.indices.length;
  const epuises = total > 0 && tentative.indicesUtilises >= total;

  const base = {
    exerciceId: exercice.id,
    titre: exercice.titre,
    difficulte: exercice.difficulte,
    date: tentative.fin ?? tentative.debut,
  };

  // 1. L'exercice a-t-il été tenté ? Une durée dérisoire invalide tout le reste.
  //    La règle vit dans `tentativeMenee` : elle est partagée avec l'écriture
  //    de la preuve, qui doit dire exactement la même chose.
  if (!tentativeMenee(tentative, exercice)) {
    return {
      ...base,
      signal: "non-tentee",
      raison: `abandonné après ${reelle} min sur ${estimee} estimées — trop court pour conclure quoi que ce soit sur la difficulté`,
    };
  }

  if (tentative.resultat === "echec") {
    return {
      ...base,
      signal: "trop-difficile",
      raison: epuises
        ? `échoué malgré les ${total} indices, en ${reelle ?? "?"} min sur ${estimee} estimées`
        : `échoué sans consulter tous les indices (${tentative.indicesUtilises}/${total}), en ${reelle ?? "?"} min`,
    };
  }

  if (tentative.resultat === "reussi") {
    const sansAide = tentative.indicesUtilises === 0;
    if (sansAide && fraction !== null && fraction < FRACTION_TROP_FACILE) {
      return {
        ...base,
        signal: "trop-facile",
        raison: `réussi sans aucun indice en ${reelle} min sur ${estimee} estimées`,
      };
    }
    return {
      ...base,
      signal: "calibre",
      raison: sansAide
        ? `réussi sans indice, en ${reelle ?? "?"} min sur ${estimee} estimées — le temps y a passé`
        : `réussi avec ${tentative.indicesUtilises} indice(s)`,
    };
  }

  // « partiel » : par construction, le niveau est atteint sans être dépassé.
  return {
    ...base,
    signal: "calibre",
    raison: `partiellement réussi avec ${tentative.indicesUtilises} indice(s), en ${
      reelle ?? "?"
    } min sur ${estimee} estimées`,
  };
}

/* ------------------------------------------------------------------ */
/* Dimension faible                                                    */
/* ------------------------------------------------------------------ */

/**
 * La dimension la plus faible des auto-évaluations retenues.
 *
 * C'est l'axe que la difficulté seule ne capture pas : un échec où
 * `comprehension` tient et `application` s'effondre n'appelle pas un exercice
 * plus facile, mais un exercice qui fait *appliquer*.
 *
 * Le nombre d'observations est renvoyé avec la valeur : une moyenne sur une
 * seule tentative reste une information, mais elle porte sa réserve (P3).
 */
export function dimensionLaPlusFaible(
  tentatives: ExerciseAttempt[],
): DimensionFaible | null {
  const cumul = new Map<Dimension, { somme: number; n: number }>();

  for (const t of tentatives) {
    for (const [dim, valeur] of Object.entries(t.autoEvaluation)) {
      if (typeof valeur !== "number") continue;
      const d = dim as Dimension;
      const courant = cumul.get(d) ?? { somme: 0, n: 0 };
      cumul.set(d, { somme: courant.somme + valeur, n: courant.n + 1 });
    }
  }

  let pire: DimensionFaible | null = null;
  for (const [dimension, { somme, n }] of cumul) {
    const moyenne = somme / n;
    // À égalité, on garde la dimension la plus observée : elle est mieux étayée.
    if (!pire || moyenne < pire.moyenne || (moyenne === pire.moyenne && n > pire.observations)) {
      pire = { dimension, moyenne: Math.round(moyenne * 100) / 100, observations: n };
    }
  }

  // Une dimension déjà maîtrisée n'est pas un point faible : ne rien signaler
  // vaut mieux que désigner arbitrairement la moins bonne d'un lot excellent.
  return pire && pire.moyenne < 1 ? pire : null;
}

/* ------------------------------------------------------------------ */
/* Calibration d'une compétence                                        */
/* ------------------------------------------------------------------ */

const AJUSTEMENT: Record<SignalCalibration, number> = {
  "trop-facile": +1,
  calibre: 0,
  "trop-difficile": -1,
  "non-tentee": 0,
};

export function calibrer(
  skill: Skill,
  exercices: Exercise[],
  tentatives: ExerciseAttempt[],
): Calibration {
  const parId = new Map(exercices.map((e) => [e.id, e]));

  // Tentatives terminées portant sur cette compétence, de la plus récente à la
  // plus ancienne. Une tentative en cours ne dit rien : elle n'a pas de résultat.
  const pertinentes = tentatives
    .filter((t) => t.statut === "terminee")
    .map((t) => ({ t, ex: parId.get(t.exerciseId) }))
    .filter((x): x is { t: ExerciseAttempt; ex: Exercise } =>
      Boolean(x.ex && x.ex.competences.includes(skill.code)),
    )
    .sort((a, b) => (b.t.fin ?? b.t.debut).localeCompare(a.t.fin ?? a.t.debut))
    .slice(0, TENTATIVES_RETENUES);

  const verdicts = pertinentes.map(({ t, ex }) => verdictTentative(t, ex));
  const dimensionFaible = dimensionLaPlusFaible(pertinentes.map((x) => x.t));

  // La difficulté se règle sur la dernière tentative EXPLOITABLE. Les autres
  // restent affichées — elles expliquent pourquoi il n'y a pas de conseil.
  const exploitable = verdicts.find((v) => v.signal !== "non-tentee");

  /*
   * ⚠️ La conversion explicite n'est pas décorative.
   *
   * `exercises.difficulte` était déclarée TEXT et `ligneVersEntite` ne coerce
   * pas : un exercice relu depuis la base portait `"1"` et non `1`. L'addition
   * ci-dessous devenait une concaténation — `"1" + 0` vaut `"10"`, borné à 5 ;
   * `"1" + (-1)` vaut `"1-1"`, donc NaN. Le 02/08/2026, DEV-03 et DEV-04
   * conseillaient une difficulté 5 sur la foi d'un partiel obtenu à
   * difficulté 1. Les tests ne le voyaient pas : ils passent des `Difficulte`
   * typées, jamais une valeur venue de la dorsale.
   *
   * La colonne est désormais INTEGER (`supabase/migration-exercices.sql`).
   * Le moteur ne s'en remet pas pour autant à la dorsale : une valeur
   * inexploitable ne conseille RIEN, et le dit. Fabriquer un nombre à partir
   * d'une entrée illisible est exactement ce que P2 interdit.
   */
  const base = exploitable ? Number(exploitable.difficulte) : Number.NaN;
  const difficulteLisible = Number.isFinite(base);
  const difficulteConseillee =
    exploitable && difficulteLisible
      ? borner(base + AJUSTEMENT[exploitable.signal])
      : null;

  const facteurs: Explication["facteurs"] = verdicts.map((v) => ({
    libelle: `${v.titre} (difficulté ${v.difficulte})`,
    valeur: v.raison,
  }));
  if (dimensionFaible) {
    facteurs.push({
      libelle: `Dimension la plus faible : ${LIBELLES_DIMENSIONS[dimensionFaible.dimension]}`,
      valeur: `${dimensionFaible.moyenne} sur ${dimensionFaible.observations} tentative(s)`,
    });
  }

  const reserves: string[] = [];
  if (verdicts.length === 0) {
    reserves.push(
      "Aucune tentative terminée sur cette compétence : la difficulté ne peut pas être dérivée, elle est déduite du niveau.",
    );
  } else if (!exploitable) {
    reserves.push(
      "Toutes les tentatives récentes ont été abandonnées trop tôt pour conclure sur la difficulté.",
    );
  } else if (!difficulteLisible) {
    reserves.push(
      `La difficulté enregistrée pour « ${exploitable.titre} » n'est pas un nombre exploitable : aucune difficulté n'est conseillée.`,
    );
  }
  if (dimensionFaible?.observations === 1) {
    reserves.push(
      "La dimension faible repose sur une seule auto-évaluation : à confirmer par une seconde.",
    );
  }

  return {
    skillCode: skill.code,
    difficulteConseillee,
    signal: exploitable?.signal ?? verdicts[0]?.signal ?? null,
    dimensionFaible,
    verdicts,
    explication: {
      resume: exploitable && difficulteConseillee !== null
        ? `Difficulté ${difficulteConseillee} conseillée : le dernier exercice exploitable a été ${
            exploitable.signal === "trop-facile"
              ? "trop facile"
              : exploitable.signal === "trop-difficile"
                ? "trop difficile"
                : "bien calibré"
          }.`
        : "Aucune difficulté dérivable des tentatives.",
      facteurs,
      nombrePreuves: verdicts.length,
      reserves,
    },
  };
}

export function calibrerToutes(
  etats: SkillState[],
  exercices: Exercise[],
  tentatives: ExerciseAttempt[],
): Map<string, Calibration> {
  return new Map(
    etats.map((e) => [e.skill.code, calibrer(e.skill, exercices, tentatives)] as const),
  );
}
