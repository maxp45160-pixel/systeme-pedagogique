import { describe, expect, it } from "vitest";
import { adaptLegacyActivities, adaptLegacyAttempt, adaptLegacyExercise } from "./legacy-activity-adapter";
import type { Exercise, ExerciseAttempt } from "./types";

const exercise: Exercise = {
  id: "ex-1",
  titre: "Appliquer une règle",
  domaine: "domaine",
  type: "application",
  difficulte: 3,
  competences: ["DEV-01"],
  dureeEstimeeMin: 20,
  enonce: "Résoudre le cas.",
  indices: ["Commencer par identifier l'invariant."],
  correction: "Une correction.",
  criteres: [{ dimension: "application", libelle: "La règle est appliquée." }],
  origine: "manuel",
};

const attempt: ExerciseAttempt = {
  id: "att-1",
  exerciseId: exercise.id,
  debut: "2026-08-13T10:00:00.000Z",
  indicesUtilises: 0,
  reponse: "Un brouillon",
  evaluation: {},
  resultat: "partiel",
  statut: "en-cours",
};

describe("adaptateur de la boucle historique", () => {
  it("expose l'exercice sans changer son identifiant source ni sa cible", () => {
    expect(adaptLegacyExercise("account-a", exercise)).toMatchObject({
      id: "legacy-exercise:ex-1",
      origin: "legacy-adapter",
      family: "entrainer",
      target: { skillCodes: ["DEV-01"] },
    });
  });

  it("n'expose comme reprise qu'une tentative ouverte", () => {
    expect(adaptLegacyAttempt("account-a", attempt)?.id).toBe("legacy-attempt:att-1");
    expect(adaptLegacyAttempt("account-a", { ...attempt, statut: "terminee" })).toBeNull();
  });

  it("ne duplique aucune entité historique", () => {
    const adapted = adaptLegacyActivities("account-a", [exercise], [attempt]);
    expect(adapted.activities).toHaveLength(1);
    expect(adapted.openRuns).toHaveLength(1);
  });
});
