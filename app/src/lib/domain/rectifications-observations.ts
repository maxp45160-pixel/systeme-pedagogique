import type { ObservationRectification, SkillObservation } from "./types";

/**
 * Dérive les observations recevables. Aucune Observation n'est modifiée :
 * une invalidation agit seulement sur les calculs qui suivent cette lecture.
 */
export function observationsApresRectifications(
  observations: SkillObservation[],
  rectifications: ObservationRectification[],
): SkillObservation[] {
  const dernierEtat = new Map<string, ObservationRectification>();

  for (const rectification of [...rectifications].sort((a, b) =>
    Date.parse(a.date) - Date.parse(b.date) || a.id.localeCompare(b.id),
  )) {
    dernierEtat.set(rectification.observationId, rectification);
  }

  return observations.filter(
    (observation) => dernierEtat.get(observation.id)?.type !== "invalidation",
  );
}
