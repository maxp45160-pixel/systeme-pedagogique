import type { Exercise, ExerciseAttempt } from "./types";
import type { ActivityRun, LearningActivity, MentalCapacity } from "./adaptive-learning";

function cognitiveDemand(exercise: Exercise): MentalCapacity {
  if (exercise.difficulte <= 2) return "faible";
  if (exercise.difficulte <= 4) return "standard";
  return "elevee";
}

/**
 * Expose un exercice historique dans le contrat commun sans le recopier ni le
 * réécrire. L'identifiant et la version restent purement déterministes.
 */
export function adaptLegacyExercise(accountId: string, exercise: Exercise): LearningActivity {
  return {
    id: `legacy-exercise:${exercise.id}`,
    accountId,
    title: exercise.titre,
    description: exercise.enonce,
    family: "entrainer",
    target: { skillCodes: exercise.competences, themeIds: [], goalIds: [] },
    estimatedDurationMinutes: exercise.dureeEstimeeMin,
    cognitiveDemand: cognitiveDemand(exercise),
    proofMode: "soumission-finale",
    workspace: "exercice-trois-actes",
    requiredTools: ["indices"],
    authorizedResources: exercise.indices.length > 0
      ? [{ id: `indices:${exercise.id}`, kind: "document-interne", label: "Indices prévus", usage: "aide" }]
      : [],
    evaluationContract: {
      scope: "soumission-finale",
      criteria: exercise.criteres.map((criterion, index) => ({
        id: `${exercise.id}:criterion:${index}`,
        label: criterion.libelle,
        dimension: criterion.dimension,
        required: true,
      })),
      assessableMilestoneIds: [],
    },
    version: 1,
    origin: "legacy-adapter",
    status: exercise.archive ? "archivee" : "active",
    archivedAt: exercise.archive ? exercise.modifieLe : undefined,
    archivedReason: exercise.archive ? "Exercice archivé dans la boucle historique." : undefined,
    createdAt: exercise.modifieLe ?? "1970-01-01T00:00:00.000Z",
    updatedAt: exercise.modifieLe ?? "1970-01-01T00:00:00.000Z",
  };
}

/** Une tentative ouverte devient une reprise ; aucune tentative close n'est dupliquée. */
export function adaptLegacyAttempt(
  accountId: string,
  attempt: ExerciseAttempt,
): ActivityRun | null {
  if (attempt.statut !== "en-cours") return null;
  return {
    id: `legacy-attempt:${attempt.id}`,
    accountId,
    activityId: `legacy-exercise:${attempt.exerciseId}`,
    activityVersion: 1,
    status: "en-cours",
    currentArtifact: attempt.reponse.trim()
      ? { kind: "markdown", ref: `attempt:${attempt.id}`, immutable: false }
      : undefined,
    createdAt: attempt.debut,
    startedAt: attempt.debut,
  };
}

export function adaptLegacyActivities(
  accountId: string,
  exercises: readonly Exercise[],
  attempts: readonly ExerciseAttempt[],
): { activities: LearningActivity[]; openRuns: ActivityRun[] } {
  return {
    activities: exercises.map((exercise) => adaptLegacyExercise(accountId, exercise)),
    openRuns: attempts.flatMap((attempt) => {
      const run = adaptLegacyAttempt(accountId, attempt);
      return run ? [run] : [];
    }),
  };
}
