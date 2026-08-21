"use server";

/**
 * Server Functions — les seules écritures du système.
 *
 * Chacune s'exécute au nom du compte connecté : `dorsaleCompte()` redirige vers
 * `/login` sans session, et les politiques RLS de PostgreSQL restent la barrière
 * d'autorisation (ADR-015). Le tuteur n'a aucun accès à ce module : il émet une
 * proposition, l'utilisateur la valide, et c'est cette validation qui écrit (P5).
 *
 * Toutes appellent `revalidatePath("/", "layout")` (ADR-024). Une écriture peut
 * déplacer un niveau, un score global et une recommandation à la fois : à 77
 * lignes en base, invalider tout coûte moins cher que de raisonner, à chaque
 * ajout, sur les écrans qu'une observation touche. Cette uniformité est aussi ce qui
 * rend sûr le cache routeur client de `next.config.ts`.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ajouter, dorsaleCompte, lire, modifier, nouvelId } from "./db";
import { verifier } from "./supabase-backend";
import { cloreExerciceAtomiquement } from "./cloture-exercice";
import { capturerDocumentProduction, inscrireFicheExercice } from "./documents";
import { lireReferentiel } from "./referentiel";
import { idExerciceDepuisActivite } from "@/lib/domain/adaptive-learning";
import {
  motifRefusExercice,
  modeRetraitExercice,
  trouverExercice,
} from "@/lib/domain/exercice";
import {
  deciderAbandonExercice,
  dureeRetenue,
  motifRefusTerminerExercice,
} from "@/lib/domain/tentative";
import {
  urlExercice,
  type ContexteNavigationExercice,
  type EtapeExercice,
} from "@/lib/domain/navigation-exercice";
import {
  autonomieObservee,
  LIBELLE_AIDE,
  qualiteDepuisDifficulte,
  type AideExterne,
} from "@/lib/engine/observation";
import { construireDocumentProductionPreuve } from "@/lib/documents/production";
import { ajouterPassageFiche, construireFicheExercice } from "@/lib/documents/fiche-exercice";
import { tentativeMenee } from "@/lib/engine/calibration";
import type {
  Difficulte,
  Dimension,
  DomaineId,
  Exercise,
  ExerciseAttempt,
  LearningSession,
  SkillObservation,
  TypeExercice,
  VerdictTuteur,
} from "@/lib/domain/types";

/* ------------------------------------------------------------------ */
/* Exercices                                                           */
/* ------------------------------------------------------------------ */

/**
 * Cet exercice appartient-il à une séance en cours ?
 *
 * Les trois clôtures de tentative écrivent chacune une entrée de journal — une
 * séance mono-exercice, comportement d'origine et toujours correct hors séance.
 * Depuis ADR-048 une séance composée est **elle-même** cette entrée : la laisser
 * en produire une seconde ferait compter deux fois le même travail, dans le
 * journal comme dans le bandeau d'activité, et le défaut serait invisible
 * puisque les deux lignes seraient exactes prises séparément.
 *
 * La règle vit dans `seanceHoteDeLExercice` (pur, testé) : les trois appelants
 * posent la même question, et une seule fonction y répond.
 *
 * ⚠️ `seanceIdContexte` est indispensable depuis que plusieurs séances peuvent
 * être ouvertes en même temps (16/08/2026). Sans lui, un exercice présent dans
 * deux séances ouvertes serait rattaché à la plus récente — un rattachement
 * arbitraire, et invisible puisque les deux lignes de journal resteraient
 * exactes prises séparément. Le workspace sait dans quelle séance il déroule ;
 * il le dit plutôt qu'on ne le devine.
 */
export async function demarrerTentative(exerciseId: string): Promise<void> {
  const dorsale = await dorsaleCompte();
  const existantes = await lire("attempts", dorsale);
  const enCours = existantes.find(
    (t) => t.exerciseId === exerciseId && t.statut === "en-cours",
  );
  if (!enCours) {
    await ajouter("attempts", {
      id: nouvelId("att"),
      exerciseId,
      debut: new Date().toISOString(),
      indicesUtilises: 0,
      reponse: "",
      evaluation: {},
      resultat: "partiel",
      statut: "en-cours",
    } satisfies ExerciseAttempt, dorsale);
  }
  revalidatePath("/", "layout");
}

/**
 * `indicesUtilises` est le compteur courant, lu par la page qui rend le bouton.
 * Le passer évite de relire la tentative pour l'incrémenter : une requête au
 * lieu de deux. Deux onglets cliquant à la même seconde perdraient un
 * incrément — un compte est une personne, et la garde optimiste alternative
 * transformerait la perte en indice affiché mais non compté, c'est-à-dire en
 * autonomie surestimée. C'est le défaut connu qu'on refuse d'aggraver (P8).
 */
export async function debloquerIndice(
  attemptId: string,
  indicesUtilises: number,
): Promise<void> {
  const dorsale = await dorsaleCompte();
  await modifier("attempts", attemptId, { indicesUtilises: indicesUtilises + 1 }, dorsale);
  revalidatePath("/", "layout");
}

export async function enregistrerReponse(attemptId: string, reponse: string): Promise<void> {
  const dorsale = await dorsaleCompte();
  await modifier("attempts", attemptId, { reponse }, dorsale);
  revalidatePath("/", "layout");
}

export interface SoumissionExercice {
  attemptId: string;
  exerciseId: string;
  resultat: "reussi" | "partiel" | "echec";
  evaluation: Partial<Record<Dimension, number>>;
  dureeMin: number;
  notes?: string;
  /**
   * Aide extérieure au système, déclarée par l'utilisateur (ADR-033).
   *
   * Plafonne l'autonomie enregistrée : documentation → A2, assistant IA → A1,
   * correction → A0. Défaut prudent : « aucune » — le bilan d'exercice pose
   * désormais la question, et l'absence de réponse ne doit pas relever
   * l'autonomie.
   */
  aideExterne?: AideExterne;
  /**
   * Le verdict que le tuteur avait proposé, s'il y en a eu un (ADR-046).
   *
   * Il n'entre dans **aucun** calcul : la mesure reste `resultat` et
   * `evaluation`, c'est-à-dire ce que la personne a validé. Il est archivé
   * pour deux usages — qu'elle puisse le relire, et que le tuteur retrouve
   * plus tard ce qu'il avait observé.
   */
  verdictTuteur?: Omit<VerdictTuteur, "date">;
  /** Retour optionnel vers le workspace. Cette donnée ne participe à aucune mesure. */
  navigation?: ContexteNavigationExercice;
}

async function destinationApresExercice(
  exerciceId: string,
  etape: EtapeExercice,
  navigation: ContexteNavigationExercice | undefined,
  dorsale: Awaited<ReturnType<typeof dorsaleCompte>>,
): Promise<string> {
  if (!navigation) return urlExercice(exerciceId, undefined, etape);

  // Cette validation intervient après les écritures pédagogiques : un contexte
  // périmé ne peut donc jamais faire perdre une tentative ou une observation.
  const seances = await lire("sessions", dorsale);
  const valide = seances.some(
    (seance) =>
      seance.id === navigation.seanceId &&
      seance.activites.some((activite) => activite.type === "exercice" && activite.ref === exerciceId),
  );
  return urlExercice(exerciceId, valide ? navigation : undefined, etape);
}

/**
 * Clôture une tentative et écrit la ou les observations correspondantes.
 *
 * C'est le seul chemin par lequel une compétence peut évoluer depuis
 * l'interface. L'Observation porte l'autonomie observée, la qualité déduite de
 * la difficulté, et pointe vers la tentative qui la justifie
 * (protocole anti-hallucination §4, traçabilité).
 */
export async function terminerExercice(soumission: SoumissionExercice): Promise<void> {
  const dorsale = await dorsaleCompte();
  const exercices = await lire("exercises", dorsale);
  const { EXERCICES_DIAGNOSTIC } = await import("@/lib/seed/exercises");
  const exercice = trouverExercice(exercices, EXERCICES_DIAGNOSTIC, soumission.exerciseId);
  if (!exercice) throw new Error(`Exercice introuvable : ${soumission.exerciseId}`);

  /*
   * Le refus a lieu AVANT toute écriture, et l'ordre n'est pas cosmétique.
   *
   * La fonction écrivait d'abord la tentative puis lisait la valeur de retour
   * pour connaître `indicesUtilises`. Un refus placé après aurait laissé une
   * tentative close, avec sa durée et son évaluation, sans observation pour
   * l'expliquer — une trace à moitié écrite, plus difficile à lire qu'une
   * absence de trace.
   *
   * La règle vit dans `motifRefusTerminerExercice` (lib/domain/tentative.ts),
   * et elle est le garde-fou serveur de ce que l'interface annonce déjà — sans
   * réponse écrite, le bilan ne s'ouvre pas — ainsi que de ce que l'interface
   * ne montre pas : une tentative close ne se rejoue pas, le couple
   * tentative/exercice doit concorder, et la durée doit être exploitable par
   * `tentativeMenee`. L'interface peut être contournée, pas celle-ci.
   */
  const avant = (await lire("attempts", dorsale)).find((t) => t.id === soumission.attemptId);
  if (!avant) throw new Error("Tentative introuvable");
  const refus = motifRefusTerminerExercice(avant, soumission);
  if (refus) throw new Error(refus);

  const date = new Date().toISOString();

  /*
   * Une tentative qui n'a pas eu lieu ne produit aucune observation.
   *
   * `tentativeMenee` (lib/engine/calibration.ts) porte la règle : sous 25 % de
   * la durée estimée, sans réussite, on ne peut rien conclure. Elle gouvernait
   * la calibration de la difficulté depuis ADR-028 et **pas** l'écriture de la
   * l'Observation — d'où, le 01/08/2026, une Observation à toutes dimensions nulles écrite
   * depuis un abandon d'1 minute sur 20 estimées, qui a fait tomber DEV-01 de
   * 2,7 à 2,3. « L'absence de mesure n'est pas un zéro » (P2) était tenu d'un
   * côté et rompu de l'autre.
   *
   * La tentative reste écrite en base : c'est un fait observé, et `verdictTentative`
   * la lit pour expliquer pourquoi aucune difficulté n'est conseillée. Seul le
   * journal des Observations — la chaîne qui fait bouger un niveau — la refuse.
   */
  const menee = tentativeMenee(
    { resultat: soumission.resultat, dureeMin: soumission.dureeMin },
    exercice,
  );

  /*
   * `menee` se décide sur la durée BRUTE — « la tentative a-t-elle eu lieu ? »
   * porte sur le temps réellement écoulé. Ce qu'on ÉCRIT, en revanche, passe par
   * `dureeRetenue` (ADR-071) : `dureeMin` est du temps d'horloge, et un onglet
   * laissé ouvert une nuit produisait 1015 minutes de « travail ». Le plafond ne
   * change rien à une durée plausible, donc rien à `dureeDeReference`.
   */
  const duree =
    dureeRetenue(
      { statut: menee ? "terminee" : "abandonnee", dureeMin: soumission.dureeMin },
      exercice.dureeEstimeeMin,
    ) ?? soumission.dureeMin;

  // Projection locale du fait qui sera écrit. Elle sert à figer la production
  // documentaire avant la transaction, puis la RPC verrouille et vérifie la
  // tentative réelle avant d'accepter exactement ces valeurs.
  const tentative: ExerciseAttempt = {
    ...avant,
    fin: date,
    dureeMin: duree,
    evaluation: soumission.evaluation,
    resultat: soumission.resultat,
    statut: menee ? "terminee" : "abandonnee",
    notes: soumission.notes,
    verdictTuteur:
      menee && soumission.verdictTuteur
        ? { ...soumission.verdictTuteur, date }
        : avant.verdictTuteur,
  };

  if (!menee) {
    const session = {
      id: nouvelId("ses"),
      date,
      dureeMin: duree,
      domaines: [exercice.domaine],
      skillCodes: exercice.competences,
      activites: [{ type: "exercice", ref: exercice.id, libelle: exercice.titre }],
      resultat: "Tentative abandonnée — trop courte pour conclure",
      difficulte: `Difficulté ${exercice.difficulte}/5 · ${duree} min sur ${exercice.dureeEstimeeMin} estimées`,
      notePersonnelle: soumission.notes,
      genereAutomatiquement: true,
    } satisfies LearningSession;

    await cloreExerciceAtomiquement({
      tentative: {
        id: tentative.id,
        exerciseId: tentative.exerciseId,
        fin: date,
        dureeMin: duree,
        statut: "abandonnee",
        notes: soumission.notes,
      },
      observations: [],
      seance: session,
      seanceIdContexte: soumission.navigation?.seanceId,
    }, dorsale);

    revalidatePath("/", "layout");
    redirect(await destinationApresExercice(exercice.id, "abandon", soumission.navigation, dorsale));
  }

  const autonomie = autonomieObservee(
    tentative.indicesUtilises,
    exercice.indices.length,
    soumission.aideExterne ?? "aucune",
  );
  const qualite = qualiteDepuisDifficulte(exercice.difficulte, autonomie);

  // La réponse est une production durable avant d'être une mesure. On la
  // conserve dans le corpus puis on fige exactement cet état : la Preuve
  // pointera vers le snapshot, jamais vers un contenu éditable ultérieur.
  const production = construireDocumentProductionPreuve(exercice, tentative, date);
  const provenanceDocument = await capturerDocumentProduction(
    production,
    `preuve issue de la tentative ${tentative.id}`,
  );

  // Une observation par compétence ciblée. Les compétences secondaires sont
  // enregistrées comme observation indirecte (niveau B), pas directe.
  const observations: SkillObservation[] = exercice.competences.map((code, index) => ({
    id: nouvelId("obs"),
    skillCode: code,
    date,
    type:
      exercice.type === "programmation"
        ? "code" as const
        : exercice.type === "etude-de-cas"
          ? "etude-de-cas" as const
          : exercice.type === "calcul"
            ? "calcul" as const
            : "exercice" as const,
    niveauObservation: (index === 0 ? "A" : "B") as "A" | "B",
    autonomie,
    qualite,
    resultat: soumission.resultat,
    contexte: exercice.titre,
    dimensions: soumission.evaluation,
    competencesCombinees:
      exercice.competences.length > 1
        ? exercice.competences.filter((c) => c !== code)
        : undefined,
    source: {
      kind: "exercice" as const,
      ref: exercice.id,
      trace: { kind: "tentative" as const, ref: tentative.id },
      document: provenanceDocument,
    },
    commentaire: [
      soumission.notes,
      soumission.aideExterne && soumission.aideExterne !== "aucune"
        ? `Aide extérieure : ${LIBELLE_AIDE[soumission.aideExterne]}`
        : null,
    ]
      .filter(Boolean)
      .join(" · ") || undefined,
  }));
  // La séance est toujours fournie à la transaction. PostgreSQL l'insère
  // seulement si aucune séance en cours ne journalise déjà cet exercice.
  const session: LearningSession = {
    id: nouvelId("ses"),
    date,
    dureeMin: duree,
    domaines: [exercice.domaine],
    skillCodes: exercice.competences,
    activites: [
      { type: "exercice", ref: exercice.id, libelle: exercice.titre },
    ],
    resultat:
      soumission.resultat === "reussi"
        ? "Exercice réussi"
        : soumission.resultat === "partiel"
          ? "Exercice partiellement réussi"
          : "Exercice non abouti",
    difficulte: `Difficulté ${exercice.difficulte}/5 · ${tentative.indicesUtilises} indice(s) consulté(s)`,
    notePersonnelle: soumission.notes,
    genereAutomatiquement: true,
  };

  await cloreExerciceAtomiquement({
    tentative: {
      id: tentative.id,
      exerciseId: tentative.exerciseId,
      fin: date,
      dureeMin: duree,
      statut: "terminee",
      evaluation: soumission.evaluation,
      resultat: soumission.resultat,
      notes: soumission.notes,
      verdictTuteur: tentative.verdictTuteur,
    },
    observations,
    seance: session,
    seanceIdContexte: soumission.navigation?.seanceId,
  }, dorsale);

  // La fiche est éditoriale et explicitement best-effort. Elle vient après la
  // transaction obligatoire ; son échec interne ne transforme pas une clôture
  // réussie en resoumission et ne peut donc pas doubler le journal.
  await inscrireFicheExercice(
    construireFicheExercice(exercice, tentative, date),
    (contenuMd) => ajouterPassageFiche(contenuMd, tentative),
  );

  revalidatePath("/", "layout");
  redirect(await destinationApresExercice(exercice.id, "bilan", soumission.navigation, dorsale));
}

/**
 * Clôt une tentative sans en rien conclure — le troisième chemin de clôture.
 *
 * Il en existait deux, et tous deux passaient par `terminerExercice` : la
 * Observation écrite, et l'abandon *dérivé* d'une durée dérisoire (`tentativeMenee`,
 * ADR-030). Les deux exigent une évaluation, donc un bilan ouvert, donc
 * — depuis la règle de la réponse écrite — une réponse rédigée. Une tentative
 * qu'on ne veut pas mener n'aurait plus eu de sortie : elle serait restée
 * `en-cours` indéfiniment, et l'exercice se serait affiché « en cours » pour
 * toujours.
 *
 * Ce que cette fonction n'écrit pas est aussi important que ce qu'elle écrit :
 *
 * - **aucune observation.** L'abandon n'est pas un échec. Un échec est une mesure,
 *   il exige qu'on ait essayé ; un abandon dit seulement qu'on n'a pas essayé.
 *   Les confondre ferait tomber un niveau sur un renoncement (P2, et c'est
 *   exactement le défaut du 01/08/2026 corrigé par ADR-030).
 * - **aucun `resultat`.** L'utilisateur ne s'est pas évalué : lui prêter
 *   un « partiel » par défaut serait fabriquer la mesure qu'on refuse d'écrire.
 *   C'est sans danger pour la calibration, qui ne lit que les tentatives
 *   `terminee` (`calibrer`, `recommend`, `usageExercice` filtrent toutes).
 *
 * La séance de journal, elle, est écrite : la minute passée est un fait, et la
 * taire ferait disparaître l'abandon du suivi.
 */
export async function abandonnerExercice(
  attemptId: string,
  exerciseId: string,
  dureeMin: number,
  navigation?: ContexteNavigationExercice,
): Promise<void> {
  const dorsale = await dorsaleCompte();
  const exercices = await lire("exercises", dorsale);
  const { EXERCICES_DIAGNOSTIC } = await import("@/lib/seed/exercises");
  const exercice = trouverExercice(exercices, EXERCICES_DIAGNOSTIC, exerciseId);
  if (!exercice) throw new Error(`Exercice introuvable : ${exerciseId}`);

  /*
   * L'état de la tentative est lu AVANT toute écriture, comme dans
   * `terminerExercice` : c'est ce qui rend l'abandon idempotent. Sans cette
   * lecture, chaque clic répété écrivait sa propre séance — douze pour un seul
   * abandon le 12/08/2026 (voir `deciderAbandonExercice`, ADR-072).
   */
  const avant = (await lire("attempts", dorsale)).find((t) => t.id === attemptId);
  if (!avant) throw new Error("Tentative introuvable");
  const decision = deciderAbandonExercice(avant, exerciseId);
  if (decision.action === "refuser") throw new Error(decision.motif);

  const date = new Date().toISOString();
  /*
   * Plafonnée à `dureeEstimeeMin` (ADR-071).
   *
   * C'est ce chemin qui a produit `att-mst5fis8-rfsu6` : exercice ouvert le
   * 14/08/2026 à 18 h 15, abandonné le 15 à 11 h 11, `duree_min = 1015`.
   * `dureeMin` est du temps d'horloge, pas du temps travaillé ; une tentative
   * abandonnée n'écrit aucune observation, et le temps qu'on lui retient ne peut pas
   * dépasser ce que l'exercice était censé demander. Le repli à 1 min pour une
   * valeur inexploitable est conservé — il n'invente rien, il note qu'il s'est
   * passé quelque chose de bref.
   */
  const duree =
    dureeRetenue(
      { statut: "abandonnee", dureeMin: Math.round(dureeMin) },
      exercice.dureeEstimeeMin,
    ) ?? 1;

  if (decision.action === "abandonner") {
    const session = {
        id: nouvelId("ses"),
        date,
        dureeMin: duree,
        domaines: [exercice.domaine],
        skillCodes: exercice.competences,
        activites: [{ type: "exercice", ref: exercice.id, libelle: exercice.titre }],
        resultat: "Tentative abandonnée — aucune observation enregistrée",
        difficulte: `Difficulté ${exercice.difficulte}/5 · ${duree} min sur ${exercice.dureeEstimeeMin} estimées`,
        genereAutomatiquement: true,
      } satisfies LearningSession;

    await cloreExerciceAtomiquement({
      tentative: {
        id: attemptId,
        exerciseId,
        fin: date,
        dureeMin: duree,
        statut: "abandonnee",
      },
      observations: [],
      seance: session,
      seanceIdContexte: navigation?.seanceId,
    }, dorsale);
  }

  revalidatePath("/", "layout");
  redirect(await destinationApresExercice(exercice.id, "abandon", navigation, dorsale));
}

/* ------------------------------------------------------------------ */
/* Création manuelle d'un exercice                                     */
/* ------------------------------------------------------------------ */

export interface SoumissionExerciceManuel {
  titre: string;
  domaine: DomaineId;
  type: TypeExercice;
  difficulte: Difficulte;
  competences: string[];
  dureeEstimeeMin: number;
  enonce: string;
  indices: string[];
  correction: string;
  criteres: { dimension: Dimension; libelle: string }[];
  /**
   * D'où vient l'énoncé (ADR-004). « tuteur » quand le formulaire a été
   * pré-rempli par une proposition du tuteur, « manuel » quand l'utilisateur
   * l'a écrit lui-même. Défaut prudent : « manuel ».
   *
   * Ce champ n'est pas décoratif : il rend traçable un corpus que personne ne
   * relit (P3). Il est affiché dans la liste des exercices.
   */
  origine?: Extract<Exercise["origine"], "tuteur" | "manuel">;
  /** Pourquoi il a été écrit — voir `IntentionExercice`. Absente si non renseignée. */
  intention?: Exercise["intention"];
}

/**
 * Crée un exercice depuis l'interface. Jamais `diagnostic: true` (§1.4) — ce
 * champ reste réservé aux 10 exercices du plan d'évaluation initiale.
 */
export async function creerExercice(soumission: SoumissionExerciceManuel): Promise<string> {
  /*
   * La validation vit dans `lib/domain/exercice.ts`, partagée avec
   * `modifierExercice` (ADR-047). Deux copies auraient fini par diverger, et la
   * divergence aurait été invisible : on aurait pu faire entrer par l'édition
   * ce que la création refuse.
   */
  const refus = motifRefusExercice(soumission);
  if (refus) throw new Error(refus);

  const dorsale = await dorsaleCompte();
  const referentiel = await lireReferentiel(dorsale);

  // Un exercice attaché à une compétence inexistante produirait des observations que
  // rien ne lirait — exactement ce que `dansLePerimetre` filtre déjà côté
  // lecture, mais refusé ici à l'écriture plutôt que masqué à l'affichage.
  const inconnues = soumission.competences.filter((c) => !referentiel.codesActifs.has(c));
  if (inconnues.length > 0) {
    throw new Error(`Compétence(s) hors de ton périmètre : ${inconnues.join(", ")}`);
  }

  const exercice: Exercise = {
    id: nouvelId("ex"),
    titre: soumission.titre.trim(),
    domaine: soumission.domaine,
    type: soumission.type,
    difficulte: soumission.difficulte,
    competences: soumission.competences,
    dureeEstimeeMin: soumission.dureeEstimeeMin,
    enonce: soumission.enonce,
    indices: soumission.indices.filter((i) => i.trim().length > 0),
    correction: soumission.correction,
    criteres: soumission.criteres,
    diagnostic: false,
    // « seed » est réservé aux exercices livrés avec le logiciel : une écriture
    // depuis l'interface ne peut jamais s'en réclamer.
    origine: soumission.origine === "tuteur" ? "tuteur" : "manuel",
    ...(soumission.intention ? { intention: soumission.intention } : {}),
  };
  await ajouter("exercises", exercice, dorsale);
  revalidatePath("/", "layout");
  return exercice.id;
}

/** Ce qu'une édition peut changer. Ni `id`, ni `origine`, ni `diagnostic`. */
export type SoumissionEditionExercice = Omit<SoumissionExerciceManuel, "origine"> & {
  exerciceId: string;
};

/**
 * Corrige un exercice **sans le perdre** (ADR-047).
 *
 * ## Le manque
 *
 * Il n'existait aucun chemin de modification : `creerExercice` était la seule
 * écriture. Un énoncé ambigu, une correction fausse, une durée absurde n'avaient
 * qu'une issue — l'archivage, c'est-à-dire la mise au rebut du seul contenu
 * disponible pour une compétence qui, dans la plupart des cas, n'en a aucun
 * autre. On jetait au lieu de réparer, sur un corpus produit par un LLM que
 * personne ne relit avant usage.
 *
 * ## Ce qui ne se modifie pas, et pourquoi
 *
 * - **`id`** — c'est ce que les observations et le journal citent (`source.ref`).
 * - **`origine`** — le fait qu'un énoncé ait été rédigé par le tuteur ne cesse
 *   pas d'être vrai parce qu'on en corrige une phrase (ADR-004). Le champ dit
 *   d'où vient l'exercice, pas qui l'a retouché en dernier.
 * - **`diagnostic`** et **`archive`** — le premier n'appartient pas au compte,
 *   le second a ses propres gestes.
 *
 * ## Ce que l'édition NE répare PAS
 *
 * Les observations déjà écrites. Elles portent la mesure d'une tentative sur
 * l'énoncé **d'alors**, et corriger le texte ne les rend ni plus ni moins
 * justes — les retoucher serait réécrire l'histoire (P4). D'où `modifieLe` :
 * qui relira cet exercice saura qu'il a changé depuis, et l'écran d'édition
 * annonce le nombre de tentatives déjà portées avant le clic.
 */
async function exerciceDuCompte(
  exerciceId: string,
  dorsale: Awaited<ReturnType<typeof dorsaleCompte>>,
): Promise<Exercise> {
  const exercices = await lire("exercises", dorsale);
  const exercice = exercices.find((e) => e.id === exerciceId);
  if (!exercice) {
    throw new Error(`Exercice « ${exerciceId} » introuvable dans ta bibliothèque.`);
  }
  return exercice;
}

export async function modifierExercice(soumission: SoumissionEditionExercice): Promise<void> {
  const refus = motifRefusExercice(soumission);
  if (refus) throw new Error(refus);

  const dorsale = await dorsaleCompte();
  // Refuse les diagnostics et ce qui n'appartient pas au compte — même porte
  // que le retrait, pour que les deux gestes aient exactement la même surface.
  const avant = await exerciceDuCompte(soumission.exerciceId, dorsale);

  const referentiel = await lireReferentiel(dorsale);
  const inconnues = soumission.competences.filter((c) => !referentiel.codesActifs.has(c));
  if (inconnues.length > 0) {
    throw new Error(`Compétence(s) hors de ton périmètre : ${inconnues.join(", ")}`);
  }

  await modifier(
    "exercises",
    avant.id,
    {
      titre: soumission.titre.trim(),
      domaine: soumission.domaine,
      type: soumission.type,
      difficulte: soumission.difficulte,
      competences: soumission.competences,
      dureeEstimeeMin: soumission.dureeEstimeeMin,
      enonce: soumission.enonce,
      indices: soumission.indices.filter((i) => i.trim().length > 0),
      correction: soumission.correction,
      criteres: soumission.criteres,
      // L'écran d'édition ne propose pas encore ce champ : ne pas l'écraser
      // avec `undefined` si une intention avait été enregistrée à la création.
      ...(soumission.intention ? { intention: soumission.intention } : {}),
      modifieLe: new Date().toISOString(),
    },
    dorsale,
  );

  revalidatePath("/", "layout");
}

export interface ResultatRetraitExercice {
  tentatives: number;
  mode: "suppression" | "archivage";
}

/**
 * Retire un exercice non conforme sans effacer l'historique qui le cite
 * (ADR-035). Le mode est dérivé des tentatives, jamais choisi par l'interface.
 */
export async function retirerExercice(exerciceId: string): Promise<ResultatRetraitExercice> {
  const dorsale = await dorsaleCompte();
  const exercice = await exerciceDuCompte(exerciceId, dorsale);
  if (exercice.diagnostic) {
    throw new Error("Un exercice de diagnostic livré avec l’application ne se retire pas.");
  }

  const { count, error: erreurComptage } = await dorsale.supabase
    .from("attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", dorsale.userId)
    .eq("exercise_id", exerciceId);
  verifier("comptage des tentatives de l’exercice", erreurComptage);

  const tentatives = count ?? 0;
  const mode = modeRetraitExercice(tentatives);
  if (mode === "suppression") {
    const { data, error } = await dorsale.supabase
      .from("exercises")
      .delete()
      .eq("user_id", dorsale.userId)
      .eq("id", exercice.id)
      .select("id")
      .maybeSingle();
    verifier("suppression de l’exercice", error);
    if (!data) {
      throw new Error("Suppression de l’exercice impossible : aucune ligne n’a été retirée.");
    }
  } else {
    const archive = await modifier("exercises", exercice.id, { archive: true }, dorsale);
    if (!archive) {
      throw new Error("Archivage de l’exercice impossible : aucune ligne n’a été mise à jour.");
    }
  }

  revalidatePath("/", "layout");
  return { tentatives, mode };
}

/* ------------------------------------------------------------------ */
/* Refus de recommandation (R1)                                        */
/* ------------------------------------------------------------------ */

/**
 * Enregistre un refus de recommandation.
 *
 * Un refus est un fait observé : l'utilisateur a écarté une suggestion.
 * Il est stocké en base (et non en localStorage) pour que le moteur de
 * recommandation puisse le prendre en compte au prochain calcul.
 *
 * `exerciceId` fixe la portée : l'activité proposée (exercice, note,
 * ressource). Il est absent — parce qu'aucune activité n'était proposée,
 * comme dans le repli « Générer un exercice » — le refus porte alors sur la
 * compétence entière (`code` seul). Une activité sans code de compétence
 * reste passable : `code` est alors absent et seul `exerciceId` porte le
 * refus.
 *
 * L'expiration (7 jours) est gérée à la lecture, jamais à l'écriture : on
 * n'efface pas un fait passé, on cesse de le prendre en compte.
 */
export async function refuserRecommandation(
  code?: string,
  exerciceId?: string,
): Promise<void> {
  const dorsale = await dorsaleCompte();

  if (!code && !exerciceId) {
    throw new Error(
      "Ce refus n'a pas de cible : renseigne une compétence ou une activité.",
    );
  }

  /*
   * Un refus d'exercice est enregistré sous l'identifiant d'exercice NU
   * (`diag-log-01`), jamais sous l'identifiant d'activité legacy
   * (`legacy-exercise:diag-log-01`). C'est ce que `recommander`
   * (`choisirExercice`) et `chargerActionProposee` comparent à leur filtre —
   * stocker le préfixe rendait le refus inopérant : l'exercice refusé
   * réapparaissait dès le rafraîchissement.
   *
   * Les notes et ressources (préfixes `note:`/`ressource:`) ne sont pas
   * touchées : elles sont filtrées par leur propre identifiant d'activité.
   */
  const idExercice = exerciceId ? (idExerciceDepuisActivite(exerciceId) ?? exerciceId) : null;

  const { error } = await dorsale.supabase.from("refus_recommandations").insert({
    id: nouvelId("ref"),
    user_id: dorsale.userId,
    code: code ?? null,
    exercice_id: idExercice,
    date: new Date().toISOString(),
  });
  verifier("enregistrement du refus de recommandation", error);
  revalidatePath("/", "layout");
}

/* ------------------------------------------------------------------ */
/* Journal                                                             */
/* ------------------------------------------------------------------ */

/** Appelée par `<form action={ajouterNoteSession.bind(null, sessionId)}>`. */
export async function ajouterNoteSession(
  sessionId: string,
  formData: FormData,
): Promise<void> {
  const note = String(formData.get("note") ?? "").trim();
  // `null` et non `undefined` : vider le champ doit effacer la note en base,
  // là où `undefined` signifierait « ne pas y toucher ».
  await modifier("sessions", sessionId, { notePersonnelle: note || null });
  revalidatePath("/", "layout");
}

