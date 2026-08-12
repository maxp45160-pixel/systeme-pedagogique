import type { ExerciseAttempt } from "@/lib/domain/types";

/**
 * Relation dérivée entre un exercice et les tentatives qui le citent.
 *
 * Les tentatives restent dans `attempts` : cette carte ne fait qu'accélérer la
 * vue workspace et se reconstruit à chaque lecture. Les plus récentes sont
 * présentées en premier, sans fabriquer de mesure supplémentaire.
 */
export function regrouperTentativesParExercice(
  tentatives: ExerciseAttempt[],
): Map<string, ExerciseAttempt[]> {
  const resultat = new Map<string, ExerciseAttempt[]>();
  for (const tentative of tentatives) {
    const groupe = resultat.get(tentative.exerciseId) ?? [];
    groupe.push(tentative);
    resultat.set(tentative.exerciseId, groupe);
  }
  for (const groupe of resultat.values()) {
    groupe.sort((a, b) => (b.fin ?? b.debut).localeCompare(a.fin ?? a.debut));
  }
  return resultat;
}
