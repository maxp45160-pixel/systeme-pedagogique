import { describe, expect, it } from "vitest";
import type { ObservationRectification, SkillObservation } from "./types";
import { observationsApresRectifications } from "./rectifications-observations";

const observation = { id: "obs-1" } as SkillObservation;

function evenement(
  id: string,
  type: ObservationRectification["type"],
  date: string,
): ObservationRectification {
  return {
    id,
    observationId: "obs-1",
    date,
    type,
    motif: "Correction de référence contestable",
    origine: "administrateur",
  };
}

describe("observationsApresRectifications", () => {
  it("retire une observation invalidée sans modifier le journal brut", () => {
    const observations = [observation];
    expect(observationsApresRectifications(observations, [
      evenement("rect-1", "invalidation", "2026-09-01T12:00:00Z"),
    ])).toEqual([]);
    expect(observations).toEqual([observation]);
  });

  it("rétablit une observation quand la restauration est le dernier événement", () => {
    expect(observationsApresRectifications([observation], [
      evenement("rect-2", "restauration", "2026-09-01T13:00:00Z"),
      evenement("rect-1", "invalidation", "2026-09-01T12:00:00Z"),
    ])).toEqual([observation]);
  });

  it("compare les instants et non l'écriture des fuseaux ISO", () => {
    expect(observationsApresRectifications([observation], [
      evenement("rect-1", "restauration", "2026-09-01T13:00:00+02:00"),
      evenement("rect-2", "invalidation", "2026-09-01T12:00:00Z"),
    ])).toEqual([]);
  });
});
