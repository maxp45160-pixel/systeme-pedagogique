import type { LearningSession } from "@/lib/domain/types";
import type { Recommandation } from "./recommend";
import {
  actionCandidateDepuisRecommandation,
  type ActionCandidate,
} from "./action-candidate";

/**
 * Compose la première proposition de tableau de bord à partir du classement
 * historique. Les séances acceptées restent la source d'occupation et une
 * candidate déjà matérialisée ne doit pas réapparaître à chaque relecture.
 *
 * Cette projection ne vaut pas encore replanification : un futur recalcul qui
 * touche des séances acceptées devra passer par `calculerDiffPlan`.
 */
export function actionCandidatesDepuisRecommandations(
  recommandations: readonly Recommandation[],
  sessions: readonly LearningSession[] = [],
): ActionCandidate[] {
  const candidatesDejaAcceptees = new Set(
    sessions
      .filter((session) => session.statut === "planifiee" || session.statut === "en-cours")
      .map((session) => session.origineProposition?.candidateId)
      .filter((candidateId): candidateId is string => Boolean(candidateId)),
  );

  return recommandations
    .map((recommandation) => actionCandidateDepuisRecommandation(recommandation))
    .filter((candidate): candidate is ActionCandidate => candidate !== null)
    .filter((candidate) => !candidatesDejaAcceptees.has(candidate.candidateId));
}
