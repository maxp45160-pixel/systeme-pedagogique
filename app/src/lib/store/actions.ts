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
 * ajout, sur les écrans qu'une preuve touche. Cette uniformité est aussi ce qui
 * rend sûr le cache routeur client de `next.config.ts`.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ajouter, ajouterPlusieurs, dorsaleCompte, lire, modifier, nouvelId } from "./db";
import { verifier } from "./supabase-backend";
import { lireReferentiel } from "./referentiel";
import { compterTentatives, modeRetraitExercice } from "@/lib/domain/exercice";
import {
  autonomieObservee,
  LIBELLE_AIDE,
  qualiteDepuisDifficulte,
  type AideExterne,
} from "@/lib/engine/preuve";
import { tentativeMenee } from "@/lib/engine/calibration";
import type {
  Difficulte,
  Dimension,
  DomaineId,
  Exercise,
  ExerciseAttempt,
  LearningSession,
  SkillEvidence,
  TypeExercice,
} from "@/lib/domain/types";

/* ------------------------------------------------------------------ */
/* Exercices                                                           */
/* ------------------------------------------------------------------ */

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
      autoEvaluation: {},
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
  autoEvaluation: Partial<Record<Dimension, number>>;
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
}

/**
 * Clôture une tentative et écrit la ou les preuves correspondantes.
 *
 * C'est le seul chemin par lequel une compétence peut évoluer depuis
 * l'interface. La preuve porte l'autonomie observée, la qualité déduite de
 * la difficulté, et pointe vers la tentative qui la justifie
 * (protocole anti-hallucination §4, traçabilité).
 */
export async function terminerExercice(soumission: SoumissionExercice): Promise<void> {
  const dorsale = await dorsaleCompte();
  const exercices = await lire("exercises", dorsale);
  const { EXERCICES_DIAGNOSTIC } = await import("@/lib/seed/exercises");
  const exercice =
    exercices.find((e) => e.id === soumission.exerciseId) ??
    EXERCICES_DIAGNOSTIC.find((e) => e.id === soumission.exerciseId);
  if (!exercice) throw new Error(`Exercice introuvable : ${soumission.exerciseId}`);

  const date = new Date().toISOString();

  /*
   * Une tentative qui n'a pas eu lieu ne produit aucune preuve.
   *
   * `tentativeMenee` (lib/engine/calibration.ts) porte la règle : sous 25 % de
   * la durée estimée, sans réussite, on ne peut rien conclure. Elle gouvernait
   * la calibration de la difficulté depuis ADR-028 et **pas** l'écriture de la
   * preuve — d'où, le 01/08/2026, une preuve à toutes dimensions nulles écrite
   * depuis un abandon d'1 minute sur 20 estimées, qui a fait tomber DEV-01 de
   * 2,7 à 2,3. « L'absence de mesure n'est pas un zéro » (P2) était tenu d'un
   * côté et rompu de l'autre.
   *
   * La tentative reste écrite en base : c'est un fait observé, et `verdictTentative`
   * la lit pour expliquer pourquoi aucune difficulté n'est conseillée. Seul le
   * journal de preuves — la chaîne qui fait bouger un niveau — la refuse.
   */
  const menee = tentativeMenee(
    { resultat: soumission.resultat, dureeMin: soumission.dureeMin },
    exercice,
  );

  // La tentative renvoyée est celle qui vient d'être écrite : `indicesUtilises`
  // s'y lit sans relecture, et c'est lui qui détermine l'autonomie observée.
  const tentative = await modifier("attempts", soumission.attemptId, {
    fin: date,
    dureeMin: soumission.dureeMin,
    autoEvaluation: soumission.autoEvaluation,
    resultat: soumission.resultat,
    statut: (menee ? "terminee" : "abandonnee") as "terminee" | "abandonnee",
    notes: soumission.notes,
  }, dorsale);
  if (!tentative) throw new Error("Tentative introuvable");

  if (!menee) {
    // Le journal d'activité, lui, enregistre ce qui s'est passé : la minute
    // passée est un fait, et la taire ferait disparaître l'abandon du suivi.
    await ajouter("sessions", {
      id: nouvelId("ses"),
      date,
      dureeMin: soumission.dureeMin,
      domaines: [exercice.domaine],
      skillCodes: exercice.competences,
      activites: [{ type: "exercice", ref: exercice.id, libelle: exercice.titre }],
      resultat: "Tentative abandonnée — trop courte pour conclure",
      difficulte: `Difficulté ${exercice.difficulte}/5 · ${soumission.dureeMin} min sur ${exercice.dureeEstimeeMin} estimées`,
      notePersonnelle: soumission.notes,
      genereAutomatiquement: true,
    } satisfies LearningSession, dorsale);

    revalidatePath("/", "layout");
    redirect(`/exercices/${exercice.id}?abandon=1`);
  }

  const autonomie = autonomieObservee(
    tentative.indicesUtilises,
    exercice.indices.length,
    soumission.aideExterne ?? "aucune",
  );
  const qualite = qualiteDepuisDifficulte(exercice.difficulte, autonomie);

  // Une preuve par compétence ciblée. Les compétences secondaires sont
  // enregistrées comme preuve indirecte (niveau B), pas directe.
  const preuves: SkillEvidence[] = exercice.competences.map((code, index) => ({
    id: nouvelId("ev"),
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
    niveauPreuve: (index === 0 ? "A" : "B") as "A" | "B",
    autonomie,
    qualite,
    resultat: soumission.resultat,
    contexte: exercice.titre,
    dimensions: soumission.autoEvaluation,
    competencesCombinees:
      exercice.competences.length > 1
        ? exercice.competences.filter((c) => c !== code)
        : undefined,
    source: { kind: "exercice" as const, ref: exercice.id },
    commentaire: [
      soumission.notes,
      soumission.aideExterne && soumission.aideExterne !== "aucune"
        ? `Aide extérieure : ${LIBELLE_AIDE[soumission.aideExterne]}`
        : null,
    ]
      .filter(Boolean)
      .join(" · ") || undefined,
  }));
  await ajouterPlusieurs("evidence", preuves, dorsale);

  // Une entrée de journal est produite automatiquement (instructions §15 :
  // la maintenance du système se fait en arrière-plan).
  const session: LearningSession = {
    id: nouvelId("ses"),
    date,
    dureeMin: soumission.dureeMin,
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
  await ajouter("sessions", session, dorsale);

  revalidatePath("/", "layout");
  redirect(`/exercices/${exercice.id}?bilan=1`);
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
}

/**
 * Crée un exercice depuis l'interface. Jamais `diagnostic: true` (§1.4) — ce
 * champ reste réservé aux 10 exercices du plan d'évaluation initiale.
 */
export async function creerExercice(soumission: SoumissionExerciceManuel): Promise<string> {
  if (!soumission.titre.trim()) throw new Error("Le titre est obligatoire.");
  if (!soumission.enonce.trim()) throw new Error("L'énoncé est obligatoire.");
  if (!soumission.correction.trim()) throw new Error("La correction est obligatoire.");
  if (soumission.competences.length === 0) throw new Error("Au moins une compétence est requise.");
  if (soumission.criteres.length === 0) throw new Error("Au moins un critère est requis.");

  const dorsale = await dorsaleCompte();
  const referentiel = await lireReferentiel(dorsale);

  // Un exercice attaché à une compétence inexistante produirait des preuves que
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
  };
  await ajouter("exercises", exercice, dorsale);
  revalidatePath("/", "layout");
  return exercice.id;
}

/* ------------------------------------------------------------------ */
/* Retrait d'un exercice (calque ADR-027)                              */
/* ------------------------------------------------------------------ */

/**
 * Charge un exercice du compte, ou refuse.
 *
 * Les exercices de diagnostic sont livrés avec le logiciel et ne sont pas en
 * base : ils ne se retirent pas ligne à ligne. Les retirer du flux passe par le
 * périmètre de la compétence (`competences.active`).
 */
async function exerciceDuCompte(
  exerciceId: string,
  dorsale: Awaited<ReturnType<typeof dorsaleCompte>>,
): Promise<Exercise> {
  const exercices = await lire("exercises", dorsale);
  const exercice = exercices.find((e) => e.id === exerciceId);
  if (!exercice) {
    throw new Error(
      `Exercice « ${exerciceId} » introuvable dans ta bibliothèque. Les exercices de diagnostic sont livrés avec le logiciel et ne se retirent pas un par un.`,
    );
  }
  return exercice;
}

/** Retire l'exercice du flux sans toucher aux preuves qu'il a produites. */
export async function archiverExercice(exerciceId: string): Promise<void> {
  const dorsale = await dorsaleCompte();
  await exerciceDuCompte(exerciceId, dorsale);
  await modifier("exercises", exerciceId, { archive: true }, dorsale);
  revalidatePath("/", "layout");
}

/** Remet un exercice archivé dans le flux. */
export async function desarchiverExercice(exerciceId: string): Promise<void> {
  const dorsale = await dorsaleCompte();
  await exerciceDuCompte(exerciceId, dorsale);
  await modifier("exercises", exerciceId, { archive: false }, dorsale);
  revalidatePath("/", "layout");
}

/**
 * Supprime définitivement un exercice — **uniquement s'il ne porte aucune
 * tentative**.
 *
 * Le refus est explicite, jamais un repli silencieux sur l'archivage : c'est la
 * leçon d'ADR-027, une fonction qui fait autre chose que ce que son nom annonce
 * s'érode. Et la trace en jeu est réelle — une tentative, même abandonnée,
 * figure au journal et cite l'exercice par son titre ; l'effacer laisserait une
 * entrée qui ne résout plus.
 */
export async function supprimerExercice(exerciceId: string): Promise<void> {
  const dorsale = await dorsaleCompte();
  await exerciceDuCompte(exerciceId, dorsale);

  const tentatives = await lire("attempts", dorsale);
  const nombre = compterTentatives(exerciceId, tentatives);
  if (modeRetraitExercice(nombre) !== "suppression") {
    throw new Error(
      `Cet exercice porte ${nombre} tentative(s) : il ne peut pas être supprimé, seulement archivé. Une trace ne disparaît pas.`,
    );
  }

  const { error } = await dorsale.supabase
    .from("exercises")
    .delete()
    .eq("user_id", dorsale.userId)
    .eq("id", exerciceId);
  verifier("suppression de l'exercice", error);
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

