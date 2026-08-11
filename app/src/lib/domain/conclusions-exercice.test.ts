import { describe, expect, it } from "vitest";
import { conclusionsExercice } from "./conclusions-exercice";
import type { Exercise, ExerciseAttempt } from "./types";

const EXERCICE: Exercise = {
  id: "ex-1",
  titre: "Argumenter un choix",
  domaine: "developpement",
  type: "application",
  difficulte: 2,
  competences: ["DEV-01"],
  dureeEstimeeMin: 20,
  enonce: "Choisis et justifie.",
  indices: [],
  correction: "Une réponse possible.",
  criteres: [
    { dimension: "application", libelle: "Appliquer la règle" },
    { dimension: "justification", libelle: "Justifier le choix" },
  ],
  origine: "tuteur",
};

function tentative(extra: Partial<ExerciseAttempt> = {}): ExerciseAttempt {
  return {
    id: "at-1",
    exerciseId: EXERCICE.id,
    debut: "2026-08-11T10:00:00.000Z",
    fin: "2026-08-11T10:20:00.000Z",
    dureeMin: 20,
    indicesUtilises: 0,
    reponse: "Ma réponse",
    evaluation: { application: 1, justification: 0.25 },
    resultat: "partiel",
    statut: "terminee",
    ...extra,
  };
}

describe("conclusionsExercice", () => {
  it("privilégie les conclusions textuelles réellement conservées du tuteur", () => {
    const resultat = conclusionsExercice(EXERCICE, tentative({
      verdictTuteur: {
        resultat: "partiel",
        appreciations: {},
        justifications: {},
        bilan: {
          pointsForts: "La règle est correctement appliquée.",
          pointsBloquants: "La justification ne cite pas le compromis.",
          aRetravailler: ["Nommer le compromis avant de conclure."],
        },
        date: "2026-08-11T10:20:00.000Z",
      },
    }));

    expect(resultat.pointsForts).toEqual(["La règle est correctement appliquée."]);
    expect(resultat.erreurs).toEqual(["La justification ne cite pas le compromis."]);
    expect(resultat.actions).toEqual(["Nommer le compromis avant de conclure."]);
  });

  it("retombe sur les critères validés sans fabriquer de prose", () => {
    const resultat = conclusionsExercice(EXERCICE, tentative());
    expect(resultat.pointsForts).toEqual(["Appliquer la règle"]);
    expect(resultat.erreurs).toEqual(["Justifier le choix"]);
    expect(resultat.actions).toEqual(["Reprendre : Justifier le choix"]);
    expect(resultat.notions).toEqual(["Appliquer la règle", "Justifier le choix"]);
  });
});
