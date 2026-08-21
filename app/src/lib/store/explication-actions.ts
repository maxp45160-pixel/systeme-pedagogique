"use server";

/**
 * Enregistrement d'une auto-explication de concept — validation du niveau 1.
 *
 * Conserve la production dans le corpus documentaire, enregistre l'observation
 * directe de niveau 1 (compréhension démontrée) et journalise la séance dans le cahier.
 */

import { revalidatePath } from "next/cache";
import { ajouter, dorsaleCompte, nouvelId } from "./db";
import { lireReferentiel } from "./referentiel";
import { capturerDocumentProduction } from "./documents";
import type { EvaluationExplication } from "@/lib/domain/explication";
import type { Exercise, ExerciseAttempt, LearningSession, SkillObservation } from "@/lib/domain/types";
import { verifierTexteExplication } from "@/lib/domain/explication";
import { cloreExerciceAtomiquement } from "./cloture-exercice";

export interface EnregistrerExplicationParams {
  skillCode: string;
  texteExplication: string;
  evaluation: EvaluationExplication;
  dureeMin?: number;
}

export interface ResultatEnregistrementExplication {
  succes: boolean;
  observationId: string;
  sessionId: string;
}

export async function enregistrerExplicationAction(
  params: EnregistrerExplicationParams,
): Promise<ResultatEnregistrementExplication> {
  const { skillCode, texteExplication, evaluation, dureeMin = 10 } = params;

  const verif = verifierTexteExplication(texteExplication);
  if (!verif.valide) {
    throw new Error(verif.erreur ?? "Texte d'explication invalide.");
  }

  const referentiel = await lireReferentiel();
  const skill = referentiel.parCode.get(skillCode);
  if (!skill) {
    throw new Error(`Compétence inconnue : ${skillCode}`);
  }

  const dorsale = await dorsaleCompte();
  const dateIso = new Date().toISOString();
  const explicationId = nouvelId("exp");
  const exerciceId = `feynman-${explicationId}`;
  const exercice: Exercise = {
    id: exerciceId,
    titre: `Expliquer « ${skill.intitule} » avec ses propres mots`,
    domaine: skill.domaine,
    type: "rappel",
    difficulte: 1,
    competences: [skill.code],
    dureeEstimeeMin: Math.max(1, dureeMin),
    enonce: `Reformuler « ${skill.intitule} » avec ses propres mots, puis donner une intuition ou un exemple.`,
    indices: [],
    correction: "",
    criteres: [
      { dimension: "comprehension", libelle: "Le concept est reformulé avec justesse." },
      { dimension: "justification", libelle: "L'explication est étayée par une intuition ou un exemple." },
    ],
    diagnostic: false,
    origine: "manuel",
    // Cette activité ponctuelle a déjà été menée quand elle entre au journal.
    // L'archiver empêche le moteur de la reproposer tout en gardant sa source.
    archive: true,
  };
  const tentative: ExerciseAttempt = {
    id: explicationId,
    exerciseId: exerciceId,
    debut: dateIso,
    indicesUtilises: 0,
    reponse: texteExplication.trim(),
    evaluation: {
      comprehension: evaluation.scoreComprehension,
      justification: evaluation.scoreJustification,
    },
    resultat: evaluation.resultat,
    statut: "en-cours",
  };

  // 1. Capture de la production dans le corpus documentaire
  const documentProduction = {
    id: `preuve-${explicationId}`,
    attemptId: explicationId,
    exerciseId: exerciceId,
    contenuMd: [
      "---",
      "type: preuve",
      "role: operationnel",
      `domaine: ${skill.domaine}`,
      `created_at: ${dateIso}`,
      `produced_at: ${dateIso}`,
      `titre: "Auto-explication : ${skill.intitule.replace(/"/g, '\\"')}"`,
      "---",
      "",
      "## Compétence ciblée",
      "",
      `- [[${skill.code}]] — ${skill.intitule}`,
      "",
      "## Explication de l'apprenant",
      "",
      texteExplication.trim(),
      "",
      "## Évaluation formative du tuteur",
      "",
      `- **Résultat :** ${evaluation.resultat}`,
      `- **Compréhension :** ${Math.round(evaluation.scoreComprehension * 100)}%`,
      `- **Justification :** ${Math.round(evaluation.scoreJustification * 100)}%`,
      "",
      "### Points clés bien assimilés",
      "",
      ...(evaluation.pointsCles.length > 0
        ? evaluation.pointsCles.map((p) => `- ${p}`)
        : ["*Aucun point clé spécifique relevé.*"]),
      "",
      "### Points à perfectionner",
      "",
      ...(evaluation.pointsManquants.length > 0
        ? evaluation.pointsManquants.map((p) => `- ${p}`)
        : ["*Aucun manque majeur identifié.*"]),
      "",
      "### Commentaire du tuteur",
      "",
      evaluation.feedbackFormatif,
    ].join("\n"),
  };

  const provenanceDocument = await capturerDocumentProduction(
    documentProduction,
    `Auto-explication de la compétence ${skill.code}`,
  );

  // 2. Création de l'observation directe (Niveau 1)
  const observation: SkillObservation = {
    id: nouvelId("obs"),
    skillCode: skill.code,
    date: dateIso,
    type: "explication",
    niveauObservation: "A",
    autonomie: "A3",
    qualite: evaluation.resultat === "reussi" ? "forte" : "moyenne",
    resultat: evaluation.resultat,
    contexte: `Auto-explication : ${skill.intitule}`,
    dimensions: {
      comprehension: evaluation.scoreComprehension,
      justification: evaluation.scoreJustification,
    },
    source: {
      kind: "exercice",
      ref: exerciceId,
      document: provenanceDocument,
    },
    commentaire: evaluation.feedbackFormatif,
  };

  // 3. Création de la séance de journal
  const session: LearningSession = {
    id: nouvelId("ses"),
    date: dateIso,
    dureeMin: Math.max(1, dureeMin),
    domaines: [skill.domaine],
    skillCodes: [skill.code],
    activites: [
      {
        type: "exercice",
        ref: exerciceId,
        libelle: exercice.titre,
      },
    ],
    resultat:
      evaluation.resultat === "reussi"
        ? "Compréhension conceptuelle démontrée"
        : evaluation.resultat === "partiel"
          ? "Compréhension partielle du concept"
          : "Explication non aboutie",
    difficulte: "Compréhension conceptuelle (Niveau 1)",
    notePersonnelle: texteExplication.slice(0, 300),
    genereAutomatiquement: true,
  };

  await ajouter("exercises", exercice, dorsale);
  await ajouter("attempts", tentative, dorsale);

  await cloreExerciceAtomiquement({
    tentative: {
      id: tentative.id,
      exerciseId: tentative.exerciseId,
      fin: dateIso,
      dureeMin: Math.max(1, dureeMin),
      statut: "terminee",
      evaluation: tentative.evaluation,
      resultat: tentative.resultat,
    },
    observations: [observation],
    seance: session,
  }, dorsale);

  revalidatePath("/", "layout");

  return {
    succes: true,
    observationId: observation.id,
    sessionId: session.id,
  };
}
