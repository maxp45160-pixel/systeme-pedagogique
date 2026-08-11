import type { Exercise, ExerciseAttempt } from "./types";

/** Conclusions de relecture : uniquement le verdict conservé ou les scores validés. */
export function conclusionsExercice(exercice: Exercise, tentative?: ExerciseAttempt) {
  const notions = [...new Set(exercice.criteres.map((critere) => critere.libelle))];
  if (!tentative || tentative.statut !== "terminee") {
    return { notions, pointsForts: [], erreurs: [], actions: [] };
  }

  const bilan = tentative.verdictTuteur?.bilan;
  const pointsForts = bilan?.pointsForts.trim()
    ? [bilan.pointsForts.trim()]
    : libellesSelonScore(exercice, tentative, (score) => score >= 0.75);
  const erreurs = bilan?.pointsBloquants.trim()
    ? [bilan.pointsBloquants.trim()]
    : libellesSelonScore(exercice, tentative, (score) => score < 0.5);
  const actions = bilan?.aRetravailler.filter((action) => action.trim().length > 0) ?? [];
  const actionsDerivees = actions.length > 0
    ? actions
    : libellesSelonScore(exercice, tentative, (score) => score < 0.75).map((libelle) => `Reprendre : ${libelle}`);

  return { notions, pointsForts, erreurs, actions: actionsDerivees };
}

function libellesSelonScore(
  exercice: Exercise,
  tentative: ExerciseAttempt,
  retient: (score: number) => boolean,
): string[] {
  return [...new Set(exercice.criteres.flatMap((critere) => {
    const score = tentative.evaluation[critere.dimension];
    return typeof score === "number" && retient(score) ? [critere.libelle] : [];
  }))];
}
