/**
 * Le modèle d'assemblage — la pièce du CAF qui manquait (ADR-049).
 *
 * ## Pourquoi une seule pièce
 *
 * Le Conceptual Assessment Framework distingue quatre modèles. Trois tournent
 * déjà ici, sous d'autres noms :
 *
 * | Modèle CAF        | Ce qui le porte dans ce dépôt                        |
 * |-------------------|------------------------------------------------------|
 * | *Student model*   | `SkillState` — niveau, confiance, robustesse, contextes |
 * | *Evidence model*  | `criteres`, `Dimension`, `engine/preuve.ts`, `maitrise.ts` |
 * | *Task model*      | `Exercise` — type, difficulté, compétences, durée      |
 * | *Assembly model*  | **rien** — ce fichier                                  |
 *
 * Assembler, c'est répondre à « quelles tâches, combien, dans quel ordre, pour
 * quelles revendications ». Le produit savait déjà répondre pour **une** tâche
 * (`recommander`) et n'avait jamais eu à répondre pour un ensemble.
 *
 * ## Ce que ce module ne refait pas
 *
 * Il ne classe pas les compétences : `recommander` le fait, et un second
 * classement aurait divergé du premier sans que rien ne le signale — le tableau
 * de bord et le compositeur de séance auraient proposé deux « meilleures
 * actions » différentes le même jour. Il ne décide pas non plus si un exercice
 * est rejouable (`recommandable`, à l'intérieur de `recommander`), ni quelle
 * difficulté viser (`difficulteVisee`).
 *
 * Ce qu'il ajoute est exactement ceci : parcourir le classement jusqu'à remplir
 * *N* places, faire passer devant ce que la personne a explicitement visé, et
 * **nommer ce qui manque** au lieu de le taire.
 *
 * ## Le manquant est le produit principal
 *
 * Au 10/08/2026, 11 compétences actives sur 77 ont un exercice. Une séance de
 * quatre exercices est donc, dans le cas normal, une séance à un exercice
 * existant et trois à rédiger. `manquants` n'est pas une liste d'erreurs : c'est
 * la commande que l'écran passe au tuteur, et c'est par là que le corpus se
 * remplit. Une composition qui se rabattrait sur les compétences déjà couvertes
 * pour « faire une belle séance » reproduirait exactement le défaut qu'on
 * corrige — servir toujours les mêmes exercices parce que ce sont les seuls
 * disponibles.
 *
 * RIEN N'EST ÉCRIT ICI, et aucune horloge n'est lue : `now` est un paramètre,
 * comme dans `recommander`.
 */

import type {
  BlueprintSeance,
  CibleSeance,
  DemandeSeance,
  Difficulte,
  Exercise,
  ExerciseAttempt,
  SkillState,
} from "@/lib/domain/types";
import {
  dureesMenees,
  mediane,
  OBSERVATIONS_DUREE_MINIMUM,
  type Calibration,
  type DureeReference,
} from "./calibration";
import { difficulteVisee, recommander, type Recommandation } from "./recommend";
import {
  EXERCICES_PAR_SEANCE_MAX,
  EXERCICES_PAR_SEANCE_MIN,
} from "@/lib/domain/seance";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

/**
 * Une place de la séance tenue par un exercice qui existe déjà.
 *
 * Les trois premiers champs ont la forme exacte de `LearningSession.activites` :
 * c'est ce qui sera persisté. Le reste sert à l'écran de composition et vit,
 * côté base, dans `blueprint.cibles` — dupliquer `raison` dans `activites`
 * ferait deux endroits où lire la même justification.
 */
export interface ActiviteComposee {
  type: "exercice";
  ref: string;
  libelle: string;
  code: string;
  difficulte: Difficulte;
  dureeEstimeeMin: number;
  raison: string;
}

/** Une place de la séance qu'aucun exercice existant ne peut tenir. */
export interface ManquantSeance {
  code: string;
  intitule: string;
  difficulteCible: Difficulte;
  raison: string;
}

export interface CompositionSeance {
  /** Le blueprint tel qu'il sera écrit avec la séance, cibles remplies. */
  blueprint: BlueprintSeance;
  activites: ActiviteComposee[];
  manquants: ManquantSeance[];
  /**
   * Somme des durées estimées des exercices RETENUS. Les manquants n'y sont pas :
   * un exercice qui n'existe pas n'a pas de durée, et lui en prêter une
   * fabriquerait le nombre que P2 interdit. L'explication dit combien manquent.
   */
  dureeEstimeeTotaleMin: number;
  /** Ce que la composition a fait et n'a pas pu faire, avec ses nombres (P3). */
  explication: string[];
}

/* ------------------------------------------------------------------ */
/* Combien d'exercices tiennent dans le temps annoncé                  */
/* ------------------------------------------------------------------ */

export interface NombreConseille {
  nombre: number;
  /** La durée par exercice qui a servi au calcul, et d'où elle vient. */
  reference: DureeReference;
  /** Phrase citant le calcul et sa source — le « Pourquoi ? » du nombre (P3). */
  explication: string;
}

/**
 * Combien d'exercices tiennent dans le temps déclaré disponible.
 *
 * ## Pourquoi ce n'est pas `temps / dureeEstimeeMin`
 *
 * `dureeEstimeeMin` est écrite par un LLM et confrontée à rien : mesuré le
 * 09/08/2026, la durée réelle valait **0,48 fois** l'estimation (ADR-045).
 * Diviser par elle proposerait systématiquement deux fois trop peu d'exercices.
 * La référence est donc la **médiane des durées réellement constatées**, toutes
 * tentatives menées confondues — pas par exercice, comme `dureeDeReference`,
 * puisque la question porte ici sur une séance entière et non sur un énoncé.
 *
 * ## Ce qu'elle refuse de faire
 *
 * Rendre `null` plutôt qu'un nombre inventé. Sans tentative menée et sans
 * corpus, il n'existe aucune durée à laquelle se référer : l'écran doit alors
 * demander le nombre au lieu de le proposer (P2 — l'absence de mesure n'est pas
 * une valeur par défaut).
 *
 * Le nombre rendu est une **proposition affichée avec sa source**, que
 * l'utilisateur corrige. Il n'est jamais imposé : c'est `nombreExercices` de la
 * demande qui fait foi.
 */
export function nombreExercicesConseille(
  tempsDisponibleMin: number,
  exercices: Exercise[],
  tentatives: ExerciseAttempt[],
): NombreConseille | null {
  const reference = dureeParExerciceDeReference(exercices, tentatives);
  if (!reference) return null;

  const brut = tempsDisponibleMin / reference.minutes;
  const nombre = Math.min(
    EXERCICES_PAR_SEANCE_MAX,
    Math.max(EXERCICES_PAR_SEANCE_MIN, Math.round(brut)),
  );

  const source =
    reference.source === "observee"
      ? `${reference.minutes} min par exercice, médiane de ${reference.observations} tentative(s) réellement menée(s)`
      : `${reference.minutes} min par exercice, médiane des durées estimées du corpus — aucune tentative menée pour l'instant`;

  const borne =
    Math.round(brut) > EXERCICES_PAR_SEANCE_MAX
      ? ` Ramené à ${EXERCICES_PAR_SEANCE_MAX} : au-delà, le tuteur ne rédige pas le lot d'un seul tour.`
      : Math.round(brut) < EXERCICES_PAR_SEANCE_MIN
        ? ` Remonté à ${EXERCICES_PAR_SEANCE_MIN} : une séance sans exercice n'en est pas une.`
        : "";

  return {
    nombre,
    reference,
    explication: `${tempsDisponibleMin} min disponibles ÷ ${source} ⇒ ${nombre} exercice(s).${borne}`,
  };
}

/**
 * La durée qu'un exercice prend, pour ce compte.
 *
 * Trois sources, dans cet ordre, et la source voyage toujours avec la valeur :
 *
 *  1. la **médiane des durées observées** sur les tentatives menées ;
 *  2. à défaut, la médiane des durées **estimées** du corpus vivant — un nombre
 *     écrit par le tuteur, annoncé comme tel ;
 *  3. `null` quand il n'y a ni l'un ni l'autre. On ne fabrique pas un défaut
 *     plausible : c'est P2, et c'est la leçon d'ADR-034.
 */
function dureeParExerciceDeReference(
  exercices: Exercise[],
  tentatives: ExerciseAttempt[],
): DureeReference | null {
  const observees = dureesMenees(tentatives);
  if (observees.length >= OBSERVATIONS_DUREE_MINIMUM) {
    return {
      minutes: Math.round(mediane(observees)),
      source: "observee",
      observations: observees.length,
    };
  }

  const estimees = exercices
    .filter((e) => !e.archive)
    .map((e) => e.dureeEstimeeMin)
    .filter((d) => Number.isFinite(d) && d > 0)
    .sort((a, b) => a - b);
  if (estimees.length === 0) return null;

  return { minutes: Math.round(mediane(estimees)), source: "estimee", observations: 0 };
}

/* ------------------------------------------------------------------ */
/* Composition                                                         */
/* ------------------------------------------------------------------ */

function dansLaPortee(etat: SkillState, portee: DemandeSeance["portee"]): boolean {
  return portee.type === "mono"
    ? etat.skill.domaine === portee.domaine
    : portee.domaines.includes(etat.skill.domaine);
}

/**
 * Compose une séance à partir d'une demande.
 *
 * ⚠️ La demande est supposée **déjà validée** par `motifRefusDemande`
 * (`lib/domain/seance.ts`). Cette fonction ne valide rien, comme `recommander`
 * ne valide rien : la validation appartient au chemin d'écriture et à l'écran,
 * et la dédoubler ici en ferait une troisième autorité.
 */
export function composerSeance(
  demande: DemandeSeance,
  etats: SkillState[],
  exercices: Exercise[],
  tentatives: ExerciseAttempt[],
  calibrations?: Map<string, Calibration>,
  now: Date = new Date(),
  refus: { codes: Set<string>; exercices: Set<string> } = {
    codes: new Set(),
    exercices: new Set(),
  },
): CompositionSeance {
  const explication: string[] = [];
  const n = demande.nombreExercices;

  const dansPortee = etats.filter((e) => dansLaPortee(e, demande.portee));
  const codesDansPortee = new Set(dansPortee.map((e) => e.skill.code));

  if (dansPortee.length === 0) {
    explication.push(
      "Aucune compétence active dans le périmètre demandé : il n'y a rien à composer.",
    );
    return {
      blueprint: { ...sansCodesImposes(demande), cibles: [] },
      activites: [],
      manquants: [],
      dureeEstimeeTotaleMin: 0,
      explication,
    };
  }

  /*
   * Le classement entier, pas les cinq premiers.
   *
   * `recommander` plafonne par défaut à 5 : une séance de 6 se serait tue sur
   * sa dernière place sans que rien ne l'explique. On demande donc tout le
   * périmètre et on s'arrête nous-mêmes, en disant pourquoi.
   */
  const classement = recommander(
    dansPortee,
    exercices,
    tentatives,
    dansPortee.length,
    calibrations,
    now,
    refus,
  );
  const parCode = new Map<string, Recommandation>(
    classement.map((r) => [r.etat.skill.code, r]),
  );
  const etatsParCode = new Map(dansPortee.map((e) => [e.skill.code, e]));

  /*
   * Ce que la personne a visé passe devant.
   *
   * Sans cela, le besoin déclaré serait un formulaire décoratif : on
   * l'enregistrerait, et la séance composerait exactement ce qu'elle aurait
   * composé sans lui. L'écart entre les deux (`ecartBesoinRealise`) n'aurait
   * alors rien mesuré d'autre que l'indifférence du moteur à la demande.
   */
  const imposes = (demande.codesImposes ?? []).filter((c) => codesDansPortee.has(c));
  const horsPortee = (demande.codesImposes ?? []).filter((c) => !codesDansPortee.has(c));
  if (horsPortee.length > 0) {
    explication.push(
      `Visé mais hors du périmètre de la séance, donc écarté : ${horsPortee.join(", ")}.`,
    );
  }

  const ordre: string[] = [];
  const vus = new Set<string>();
  for (const code of [...imposes, ...classement.map((r) => r.etat.skill.code)]) {
    if (vus.has(code)) continue;
    vus.add(code);
    ordre.push(code);
  }

  const activites: ActiviteComposee[] = [];
  const manquants: ManquantSeance[] = [];
  const exercicesPris = new Set<string>();
  let couvertsParUnAutre = 0;

  for (const code of ordre) {
    if (activites.length + manquants.length >= n) break;

    const rec = parCode.get(code);
    const etat = etatsParCode.get(code);
    if (!etat) continue;

    const exercice = rec?.exercice ?? null;

    if (exercice) {
      /*
       * Un exercice peut viser plusieurs compétences. S'il est déjà pris, la
       * compétence est de fait couverte par la place précédente : on passe à la
       * suivante SANS consommer de place, plutôt que d'inscrire deux fois le
       * même énoncé ou de le déclarer manquant alors qu'il est là.
       */
      if (exercicesPris.has(exercice.id)) {
        couvertsParUnAutre += 1;
        continue;
      }
      exercicesPris.add(exercice.id);
      activites.push({
        type: "exercice",
        ref: exercice.id,
        libelle: exercice.titre,
        code,
        difficulte: exercice.difficulte,
        dureeEstimeeMin: exercice.dureeEstimeeMin,
        raison: rec!.raison,
      });
      continue;
    }

    /*
     * Aucun exercice éligible. Ce n'est pas une anomalie : c'est le cas
     * majoritaire, et c'est le signal utile. Un code imposé sans recommandation
     * du tout (compétence dont tous les exercices ont été passés, donc écartée
     * par `recommander`) arrive ici aussi, et c'est voulu — la personne l'a
     * demandé, il lui faut un exercice neuf.
     */
    manquants.push({
      code,
      intitule: etat.skill.intitule,
      difficulteCible: rec?.difficulteCible ?? difficulteVisee(etat, calibrations?.get(code)),
      raison: rec
        ? rec.raison
        : "Tous ses exercices ont déjà été menés : il en faut un nouveau pour la remesurer.",
    });
  }

  const places = activites.length + manquants.length;
  const dureeEstimeeTotaleMin = activites.reduce((s, a) => s + a.dureeEstimeeMin, 0);

  explication.push(
    `${n} exercice(s) demandé(s) : ${activites.length} trouvé(s) en bibliothèque, ${manquants.length} à rédiger.`,
  );
  if (couvertsParUnAutre > 0) {
    explication.push(
      `${couvertsParUnAutre} compétence(s) sont déjà couvertes par un exercice retenu, qui en vise plusieurs.`,
    );
  }
  if (places < n) {
    explication.push(
      `Le périmètre ne compte que ${places} compétence(s) à travailler : la séance en contient ${places} au lieu de ${n}.`,
    );
  }
  explication.push(
    `Durée estimée des exercices retenus : ${dureeEstimeeTotaleMin} min pour une cible de ${demande.dureeCibleMin} min.`,
  );
  if (manquants.length > 0) {
    explication.push(
      `${manquants.length} exercice(s) restent à rédiger : leur durée n'est pas connue et n'entre pas dans ce total.`,
    );
  }

  /*
   * Les cibles suivent l'ordre des places, activités puis manquants confondus :
   * c'est l'ordre dans lequel la séance se déroulera, et c'est ce qu'on veut
   * relire plus tard. Elles sont la trace de la décision, pas une donnée de
   * calcul — rien ne les relit pour en dériver quoi que ce soit.
   */
  const cibles: CibleSeance[] = [
    ...activites.map((a) => ({ code: a.code, difficulte: a.difficulte, raison: a.raison })),
    ...manquants.map((m) => ({
      code: m.code,
      difficulte: m.difficulteCible,
      raison: m.raison,
    })),
  ];

  return {
    blueprint: { ...sansCodesImposes(demande), cibles },
    activites,
    manquants,
    dureeEstimeeTotaleMin,
    explication,
  };
}

/**
 * `codesImposes` appartient à la demande, pas au blueprint persisté : ce que la
 * personne a visé vit déjà dans `besoinDeclare.codesVises`, et le recopier dans
 * le blueprint donnerait deux exemplaires de la même déclaration, libres de
 * diverger.
 */
function sansCodesImposes(demande: DemandeSeance): Omit<BlueprintSeance, "cibles"> {
  return {
    dureeCibleMin: demande.dureeCibleMin,
    nombreExercices: demande.nombreExercices,
    portee: demande.portee,
  };
}
