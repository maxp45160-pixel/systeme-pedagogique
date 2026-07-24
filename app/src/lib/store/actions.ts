"use server";

/**
 * Server Functions — les seules écritures du système.
 *
 * Application mono-utilisateur exécutée en local : il n'y a pas
 * d'authentification. Ne pas exposer cette application sur un réseau public
 * en l'état (voir README).
 */

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ajouter, lire, nouvelId, remplacer } from "./db";
import { COOKIE_DEMO, modeDemoActif } from "./context";
import type {
  Autonomie,
  Dimension,
  ExerciseAttempt,
  LearningSession,
  Objectif,
  QualitePreuve,
  SkillEvidence,
} from "@/lib/domain/types";

/** Le mode démonstration n'écrit jamais rien : toute mutation y est refusée. */
async function refuserSiDemo(): Promise<void> {
  if (await modeDemoActif()) {
    throw new Error(
      "Mode démonstration actif : les données fictives ne peuvent pas être modifiées, et le profil réel n'est pas touché.",
    );
  }
}

/* ------------------------------------------------------------------ */
/* Mode démonstration                                                  */
/* ------------------------------------------------------------------ */

export async function basculerModeDemo(): Promise<void> {
  const jar = await cookies();
  const actif = jar.get(COOKIE_DEMO)?.value === "1";
  if (actif) {
    jar.delete(COOKIE_DEMO);
  } else {
    jar.set(COOKIE_DEMO, "1", { httpOnly: false, sameSite: "lax", path: "/" });
  }
  revalidatePath("/", "layout");
}

/* ------------------------------------------------------------------ */
/* Exercices                                                           */
/* ------------------------------------------------------------------ */

export async function demarrerTentative(exerciseId: string): Promise<void> {
  await refuserSiDemo();
  const existantes = await lire("attempts");
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
    } satisfies ExerciseAttempt);
  }
  revalidatePath(`/exercices/${exerciseId}`);
}

export async function debloquerIndice(attemptId: string, exerciseId: string): Promise<void> {
  await refuserSiDemo();
  await remplacer("attempts", attemptId, (t) => ({
    ...t,
    indicesUtilises: t.indicesUtilises + 1,
  }));
  revalidatePath(`/exercices/${exerciseId}`);
}

export async function enregistrerReponse(
  attemptId: string,
  exerciseId: string,
  reponse: string,
): Promise<void> {
  await refuserSiDemo();
  await remplacer("attempts", attemptId, (t) => ({ ...t, reponse }));
  revalidatePath(`/exercices/${exerciseId}`);
}

/**
 * Déduit l'autonomie du nombre d'indices réellement consultés.
 * L'utilisateur ne la choisit pas : elle est observée, pas déclarée.
 */
function autonomieDepuisIndices(indices: number, total: number): Autonomie {
  if (total > 0 && indices >= total) return "A1";
  if (indices >= 2) return "A2";
  if (indices === 1) return "A2";
  return "A3";
}

function qualiteDepuisDifficulte(difficulte: number, autonomie: Autonomie): QualitePreuve {
  if (autonomie === "A0" || autonomie === "A1") return "faible";
  if (difficulte >= 4 && (autonomie === "A3" || autonomie === "A4")) return "forte";
  if (difficulte <= 1) return "faible";
  return "moyenne";
}

export interface SoumissionExercice {
  attemptId: string;
  exerciseId: string;
  resultat: "reussi" | "partiel" | "echec";
  autoEvaluation: Partial<Record<Dimension, number>>;
  dureeMin: number;
  notes?: string;
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
  await refuserSiDemo();

  const exercices = await lire("exercises");
  const { EXERCICES_DIAGNOSTIC } = await import("@/lib/seed/exercises");
  const exercice =
    exercices.find((e) => e.id === soumission.exerciseId) ??
    EXERCICES_DIAGNOSTIC.find((e) => e.id === soumission.exerciseId);
  if (!exercice) throw new Error(`Exercice introuvable : ${soumission.exerciseId}`);

  const tentative = await remplacer("attempts", soumission.attemptId, (t) => ({
    ...t,
    fin: new Date().toISOString(),
    dureeMin: soumission.dureeMin,
    autoEvaluation: soumission.autoEvaluation,
    resultat: soumission.resultat,
    statut: "terminee" as const,
    notes: soumission.notes,
  }));
  if (!tentative) throw new Error("Tentative introuvable");

  const autonomie = autonomieDepuisIndices(tentative.indicesUtilises, exercice.indices.length);
  const qualite = qualiteDepuisDifficulte(exercice.difficulte, autonomie);
  const date = new Date().toISOString();

  // Une preuve par compétence ciblée. Les compétences secondaires sont
  // enregistrées comme preuve indirecte (niveau B), pas directe.
  for (const [index, code] of exercice.competences.entries()) {
    const preuve: SkillEvidence = {
      id: nouvelId("ev"),
      skillCode: code,
      date,
      type:
        exercice.type === "programmation"
          ? "code"
          : exercice.type === "etude-de-cas"
            ? "etude-de-cas"
            : exercice.type === "calcul"
              ? "calcul"
              : "exercice",
      niveauPreuve: index === 0 ? "A" : "B",
      autonomie,
      qualite,
      resultat: soumission.resultat,
      contexte: exercice.titre,
      dimensions: soumission.autoEvaluation,
      competencesCombinees:
        exercice.competences.length > 1
          ? exercice.competences.filter((c) => c !== code)
          : undefined,
      source: { kind: "exercice", ref: exercice.id },
      commentaire: soumission.notes,
    };
    await ajouter("evidence", preuve);
  }

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
  await ajouter("sessions", session);

  revalidatePath("/", "layout");
  redirect(`/exercices/${exercice.id}?bilan=1`);
}

/* ------------------------------------------------------------------ */
/* Erreurs récurrentes                                                 */
/* ------------------------------------------------------------------ */

/**
 * Fait évoluer le statut d'une erreur. Le passage à « corrigée » exige une
 * preuve : règle de non-suppression (anti-hallucination §6) — on ne raye
 * jamais une faiblesse sans démonstration.
 */
export async function changerStatutErreur(
  erreurId: string,
  statut: "nouvelle" | "en-cours" | "corrigee" | "consolidee",
): Promise<void> {
  await refuserSiDemo();
  await remplacer("errors", erreurId, (e) => ({ ...e, statut }));
  revalidatePath("/erreurs");
}

/* ------------------------------------------------------------------ */
/* Journal                                                             */
/* ------------------------------------------------------------------ */

/** Appelée par `<form action={ajouterNoteSession.bind(null, sessionId)}>`. */
export async function ajouterNoteSession(
  sessionId: string,
  formData: FormData,
): Promise<void> {
  await refuserSiDemo();
  const note = String(formData.get("note") ?? "").trim();
  await remplacer("sessions", sessionId, (s) => ({
    ...s,
    notePersonnelle: note || undefined,
  }));
  revalidatePath("/journal");
}

/* ------------------------------------------------------------------ */
/* Objectifs                                                           */
/* ------------------------------------------------------------------ */

/** Appelée par `<form action={definirObjectif.bind(null, horizon)}>`. */
export async function definirObjectif(
  horizon: Objectif["horizon"],
  formData: FormData,
): Promise<void> {
  await refuserSiDemo();
  const libelle = String(formData.get("libelle") ?? "");
  const skillCodes = String(formData.get("skillCodes") ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  if (!libelle.trim()) return;

  const actuels = await lire("objectives");
  const conserves = actuels.filter((o) => o.horizon !== horizon);
  const nouveau: Objectif = {
    id: nouvelId("obj"),
    horizon,
    libelle: libelle.trim(),
    skillCodes,
    dateCreation: new Date().toISOString(),
  };
  const { ecrire } = await import("./db");
  await ecrire("objectives", [...conserves, nouveau]);
  revalidatePath("/");
}
