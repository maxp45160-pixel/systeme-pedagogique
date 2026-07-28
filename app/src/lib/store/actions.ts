"use server";

/**
 * Server Functions — les seules écritures du système.
 *
 * Application mono-utilisateur exécutée en local : il n'y a pas
 * d'authentification. Ne pas exposer cette application sur un réseau public
 * en l'état (voir README).
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ajouter, lire, nouvelId, remplacer } from "./db";
import type {
  Autonomie,
  Difficulte,
  Dimension,
  DomaineId,
  Exercise,
  ExerciseAttempt,
  LearningSession,
  Objectif,
  QualitePreuve,
  SkillEvidence,
  TypeExercice,
} from "@/lib/domain/types";

/* ------------------------------------------------------------------ */
/* Exercices                                                           */
/* ------------------------------------------------------------------ */

export async function demarrerTentative(exerciseId: string): Promise<void> {
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
/* Preuve manuelle (hors exercice du store)                            */
/* ------------------------------------------------------------------ */

export interface SoumissionPreuveManuelle {
  skillCode: string;
  date?: string; // ISO ; défaut : maintenant
  type: SkillEvidence["type"];
  niveauPreuve: "A" | "B";
  autonomie: Autonomie;
  qualite: QualitePreuve;
  resultat: "reussi" | "partiel" | "echec";
  contexte: string;
  dimensions: Partial<Record<Dimension, number>>;
  competencesCombinees?: string[];
  sourceRef: string; // description vérifiable : "Script Python exécuté le 26/07", etc.
  commentaire?: string;
}

/**
 * Deuxième chemin d'écriture d'une preuve, à côté de `terminerExercice`.
 * Couvre tout travail qui ne passe pas par un `Exercise` du store : script
 * exécuté seul, exercice papier, synthèse d'un échange avec le tuteur.
 *
 * Mêmes garde-fous : source toujours renseignée, dimensions non observées
 * simplement omises (jamais un 0 par défaut).
 * L'autonomie est ici DÉCLARÉE, pas déduite (§1.1 de la spec) : le commentaire
 * stocké le signale toujours, pour que la distinction reste visible en aval.
 */
export async function enregistrerPreuveManuelle(
  soumission: SoumissionPreuveManuelle,
): Promise<void> {
  if (!soumission.contexte.trim()) throw new Error("Le contexte est obligatoire.");
  if (!soumission.sourceRef.trim()) throw new Error("La source est obligatoire.");

  const { SKILL_PAR_CODE } = await import("@/lib/domain/referentiel");
  const skill = SKILL_PAR_CODE.get(soumission.skillCode);
  if (!skill) throw new Error(`Compétence inconnue : ${soumission.skillCode}`);

  const date = soumission.date ?? new Date().toISOString();

  const preuve: SkillEvidence = {
    id: nouvelId("ev"),
    skillCode: soumission.skillCode,
    date,
    type: soumission.type,
    niveauPreuve: soumission.niveauPreuve,
    autonomie: soumission.autonomie,
    qualite: soumission.qualite,
    resultat: soumission.resultat,
    contexte: soumission.contexte.trim(),
    dimensions: soumission.dimensions,
    competencesCombinees: soumission.competencesCombinees?.length
      ? soumission.competencesCombinees
      : undefined,
    source: { kind: "manuel", ref: soumission.sourceRef.trim() },
    commentaire: ["Autonomie auto-déclarée (non déduite).", soumission.commentaire?.trim()]
      .filter(Boolean)
      .join(" — "),
  };
  await ajouter("evidence", preuve);

  // Même logique que `terminerExercice` : une entrée de journal automatique
  // (instructions §15 — la maintenance se fait en arrière-plan).
  const session: LearningSession = {
    id: nouvelId("ses"),
    date,
    domaines: [skill.domaine],
    skillCodes: [soumission.skillCode],
    activites: [
      { type: "preuve-manuelle", ref: preuve.id, libelle: soumission.contexte.trim() },
    ],
    resultat:
      soumission.resultat === "reussi"
        ? "Preuve enregistrée manuellement — réussie"
        : soumission.resultat === "partiel"
          ? "Preuve enregistrée manuellement — partielle"
          : "Preuve enregistrée manuellement — non aboutie",
    notePersonnelle: soumission.commentaire,
    genereAutomatiquement: true,
  };
  await ajouter("sessions", session);

  revalidatePath("/", "layout");
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
  await ajouter("exercises", exercice);
  revalidatePath("/exercices");
  return exercice.id;
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
