import { describe, expect, it } from "vitest";
import { regrouperTentativesParExercice } from "./workspace";
import type { ExerciseAttempt } from "@/lib/domain/types";

const tentative = (id: string, exerciseId: string, debut: string): ExerciseAttempt => ({
  id,
  exerciseId,
  debut,
  indicesUtilises: 0,
  reponse: "",
  evaluation: {},
  resultat: "partiel",
  statut: "terminee",
});

describe("regrouperTentativesParExercice", () => {
  it("relie et ordonne les tentatives sans mélanger les exercices", () => {
    const groupes = regrouperTentativesParExercice([
      tentative("a1", "ex-a", "2026-08-01T10:00:00Z"),
      tentative("b1", "ex-b", "2026-08-03T10:00:00Z"),
      tentative("a2", "ex-a", "2026-08-04T10:00:00Z"),
    ]);

    expect(groupes.get("ex-a")?.map((item) => item.id)).toEqual(["a2", "a1"]);
    expect(groupes.get("ex-b")?.map((item) => item.id)).toEqual(["b1"]);
    expect(groupes.has("ex-inconnu")).toBe(false);
  });
});
