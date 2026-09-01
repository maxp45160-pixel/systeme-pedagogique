import { describe, expect, it } from "vitest";
import {
  construireInterventionDepuisContenu,
  gestesPourContenuModule,
} from "./travail-contenu-module";

describe("travail depuis un contenu de module", () => {
  it("propose les gestes propres à chaque contenu", () => {
    expect(gestesPourContenuModule("cours").map((geste) => geste.type)).toEqual([
      "read", "synthesize", "recall", "explain",
    ]);
    expect(gestesPourContenuModule("devoir")).toEqual([{ type: "produce", libelle: "Produire" }]);
    expect(gestesPourContenuModule("document-inconnu")).toEqual([]);
  });

  it("déclare l'exercice donné comme préparation, jamais comme mesure", () => {
    const intervention = construireInterventionDepuisContenu({
      documentId: "td-1",
      titre: "Exercice 1",
      typeDocument: "exercice-donne",
      geste: "resolve",
      skillCodes: ["LOG-01", "LOG-01"],
    });

    expect(intervention).toMatchObject({
      type: "resolve",
      expectedEffect: "preparation",
      source: { kind: "document", ref: "td-1" },
      targetSkillCodes: ["LOG-01"],
    });
    expect(intervention.proofContract).toBeUndefined();
  });

  it("refuse un geste générique qui ne correspond pas au contenu", () => {
    expect(() => construireInterventionDepuisContenu({
      documentId: "devoir-1",
      titre: "Devoir",
      typeDocument: "devoir",
      geste: "recall",
    })).toThrow("Ce geste n’est pas disponible");
  });
});
