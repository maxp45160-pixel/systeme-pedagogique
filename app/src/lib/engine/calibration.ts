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
 * Réussi sans aucun indice en deçà de cette fraction de la durée de référence :
 * l'exercice n'a pas résisté.
 *
 * Calé sur les données réelles : `diag-dev-05` (12 min sur 25) et `diag-prod-01`
 * (14 min sur 35) sont manifestement sous le niveau ; `diag-prod-03` (32 sur 35)
 * et `diag-ro-01` (61 sur 35) ne le sont pas. Le seuil sépare exactement ces
 * deux groupes.
 *
 * ⚠️ Ces quatre observations sont des DIAGNOSTICS, dont la durée était rédigée
 * à la main. Les exercices générés par le tuteur, eux, portent une durée que
 * personne n'a confrontée au réel — voir `dureeDeReference` ci-dessous, et
 * l'ADR-045 pour ce que cela a coûté.
 */
export const FRACTION_TROP_FACILE = 0.6;

/** Fenêtre d'observation. Au-delà, la calibration suivrait un passé révolu. */
export const TENTATIVES_RETENUES = 3;

/**
 * Combien de tentatives il faut avant de préférer le réel à l'estimation.
 *
 * Une seule durée observée n'est pas une référence, c'est une anecdote : la
 * comparer à elle-même donnerait toujours une fraction de 1. À deux, il existe
 * un point de comparaison, et la médiane commence à dire quelque chose sur
 * l'exercice plutôt que sur la séance.
 */
export const OBSERVATIONS_DUREE_MINIMUM = 2;

/**
 * Combien de verdicts doivent aller dans le même sens pour bouger la difficulté.
 *
 * Observé le 09/08/2026 sur les 46 tentatives réelles : **7 des 10 réussites**
 * sur exercices non diagnostiques étaient classées `trop-facile`, et la durée
 * réelle valait en moyenne **0,48 fois** la durée estimée par le tuteur. Comme
 * la difficulté conseillée ne lisait que le DERNIER verdict exploitable, l'effet
 * était cumulatif : trois réussites rapides d'affilée poussaient de 2 à 5, et
 * cette valeur repartait dans le prompt de génération, où le tuteur a consigne
 * de s'y conformer.
 *
 * Exiger une confirmation ne rend pas la mesure plus juste — c'est
 * `dureeDeReference` qui s'en charge — mais empêche une observation isolée de
 * déplacer une décision pédagogique. Un exercice expédié parce qu'on avait déjà
 * vu le sujet la veille n'est pas un exercice trop facile (ADR-045).
 */
export const SIGNAUX_CONCORDANTS = 2;

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

/**
 * La durée à laquelle une tentative se compare, et d'où elle vient.
 *
 * La source est renvoyée avec la valeur parce qu'elle change ce que la mesure
 * vaut : `estimee` est ce qu'un modèle a écrit, `observee` est ce qui s'est
 * passé. Un nombre sans sa source est exactement ce que P3 interdit.
 */
export interface DureeReference {
  minutes: number;
  source: "observee" | "estimee";
  /** Nombre de tentatives derrière la médiane. `0` quand la source est l'estimation. */
  observations: number;
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
 * À quelle durée comparer une tentative sur cet exercice.
 *
 * `dureeEstimeeMin` est écrite par le tuteur, bornée pour la forme (5–240) et
 * confrontée à rien. Mesuré le 09/08/2026 : sur les réussites réelles, le temps
 * effectivement passé valait **0,48 fois** cette estimation. Le moteur s'en
 * servait pourtant comme d'un instrument gradué — et concluait « trop facile »
 * sur 7 réussites sur 10.
 *
 * Dès qu'il existe assez de tentatives sur l'exercice, la référence devient
 * donc la **médiane des durées réellement constatées** : elle ne mesure plus
 * l'optimisme d'un modèle, mais ce que cet exercice demande. L'estimation reste
 * le repli — il faut bien un point de départ au premier passage — et la source
 * voyage avec la valeur pour que la phrase affichée dise laquelle a servi.
 *
 * La médiane, pas la moyenne : sur deux ou trois points, une séance interrompue
 * à 2 minutes tirerait la moyenne assez bas pour rendre tout le reste « lent ».
 *
 * ⚠️ Cette référence ne sert QU'à juger le calibrage. `tentativeMenee` — la
 * règle qui décide si une preuve s'écrit (ADR-030) — continue de lire
 * `dureeEstimeeMin`, et ce n'est pas un oubli : elle se pose une autre question
 * (« la tentative a-t-elle eu lieu ? »), elle tranche le plus souvent au
 * PREMIER passage, quand aucune observation n'existe encore, et rien dans les
 * données du 09/08 ne la met en cause — une seule réussite sous 25 %.
 * La desserrer d'un côté est précisément ce que CLAUDE.md interdit.
 */
export function dureeDeReference(
  exercice: Pick<Exercise, "id" | "dureeEstimeeMin">,
  tentatives: Pick<ExerciseAttempt, "exerciseId" | "statut" | "dureeMin">[],
): DureeReference {
  const durees = tentatives
    .filter((t) => t.exerciseId === exercice.id && t.statut === "terminee")
    .map((t) => t.dureeMin)
    .filter((d): d is number => typeof d === "number" && Number.isFinite(d) && d > 0)
    .sort((a, b) => a - b);

  if (durees.length >= OBSERVATIONS_DUREE_MINIMUM) {
    const milieu = Math.floor(durees.length / 2);
    const mediane =
      durees.length % 2 === 0 ? (durees[milieu - 1] + durees[milieu]) / 2 : durees[milieu];
    return { minutes: mediane, source: "observee", observations: durees.length };
  }

  return { minutes: exercice.dureeEstimeeMin, source: "estimee", observations: 0 };
}

/** Comment nommer la référence dans une phrase — la source, jamais implicite. */
function libelleReference(reference: DureeReference): string {
  return reference.source === "observee"
    ? `${reference.minutes} min habituellement constatées (médiane de ${reference.observations} tentatives)`
    : `${reference.minutes} estimées`;
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
  /** Défaut : l'estimation du tuteur, comme avant `dureeDeReference`. */
  reference: DureeReference = {
    minutes: exercice.dureeEstimeeMin,
    source: "estimee",
    observations: 0,
  },
): VerdictTentative {
  const estimee = exercice.dureeEstimeeMin;
  const reelle = tentative.dureeMin;
  const repere = reference.minutes;
  const fraction = repere > 0 && reelle !== undefined ? reelle / repere : null;
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
        raison: `réussi sans aucun indice en ${reelle} min sur ${libelleReference(reference)}`,
      };
    }
    return {
      ...base,
      signal: "calibre",
      raison: sansAide
        ? `réussi sans indice, en ${reelle ?? "?"} min sur ${libelleReference(reference)} — le temps y a passé`
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

  /*
   * La référence de durée se calcule sur TOUTES les tentatives de l'exercice,
   * pas seulement sur les trois retenues pour cette compétence : la question
   * « combien de temps cet exercice demande-t-il ? » ne dépend pas de la
   * fenêtre d'observation de la compétence qu'on est en train de calibrer.
   */
  const verdicts = pertinentes.map(({ t, ex }) =>
    verdictTentative(t, ex, dureeDeReference(ex, tentatives)),
  );
  const dimensionFaible = dimensionLaPlusFaible(pertinentes.map((x) => x.t));

  // La difficulté se règle sur la dernière tentative EXPLOITABLE. Les autres
  // restent affichées — elles expliquent pourquoi il n'y a pas de conseil.
  const exploitables = verdicts.filter((v) => v.signal !== "non-tentee");
  const exploitable = exploitables[0];

  /*
   * Bouger la difficulté demande une CONFIRMATION (ADR-045).
   *
   * La règle lisait le dernier verdict exploitable et lui obéissait. Sur les
   * données réelles du 09/08/2026, cela suffisait à faire monter une compétence
   * de 2 à 5 en trois réussites rapides — et la valeur repartait dans le prompt
   * du tuteur, qui a consigne de s'y conformer.
   *
   * Le plus récent commande toujours le SENS : deux « trop facile » anciens ne
   * doivent pas l'emporter sur un « trop difficile » d'hier. Mais il ne suffit
   * plus seul — il lui faut un second verdict du même signe dans la fenêtre.
   * Sans confirmation, la difficulté ne bouge pas : elle reste celle du dernier
   * exercice exploitable, ce qui est un conseil, pas une abstention.
   */
  const concordants = exploitable
    ? exploitables.filter((v) => v.signal === exploitable.signal).length
    : 0;
  const sensDemande = exploitable ? AJUSTEMENT[exploitable.signal] : 0;
  const confirme = concordants >= SIGNAUX_CONCORDANTS;
  const ajustement = sensDemande !== 0 && confirme ? sensDemande : 0;

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
    exploitable && difficulteLisible ? borner(base + ajustement) : null;

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
  // Une confirmation manquante n'est pas une panne : c'est une retenue, et elle
  // se dit. Sans cette phrase, la difficulté paraîtrait simplement ne pas
  // réagir à ce que la dernière tentative vient pourtant de montrer.
  if (exploitable && difficulteLisible && sensDemande !== 0 && !confirme) {
    reserves.push(
      `Un seul verdict va dans ce sens (« ${
        exploitable.signal === "trop-facile" ? "trop facile" : "trop difficile"
      } ») : la difficulté ne bouge pas tant qu'une seconde tentative ne le confirme pas.`,
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
        ? ajustement !== 0
          ? `Difficulté ${difficulteConseillee} conseillée : ${concordants} exercices exploitables sur ${exploitables.length} ont été ${
              exploitable.signal === "trop-facile" ? "trop faciles" : "trop difficiles"
            }.`
          : sensDemande !== 0
            ? `Difficulté ${difficulteConseillee} maintenue : le dernier exercice exploitable a été ${
                exploitable.signal === "trop-facile" ? "trop facile" : "trop difficile"
              }, mais seul de son avis.`
            : `Difficulté ${difficulteConseillee} conseillée : le dernier exercice exploitable était bien calibré.`
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
