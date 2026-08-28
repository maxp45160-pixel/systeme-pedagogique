import { describe, expect, it } from "vitest";
import {
  INTERVENTION_EFFECTS,
  INTERVENTION_TYPES,
  interventionPeutProduireObservation,
  parseInterventionSeance,
  parseInterventionsSeance,
} from "./intervention-seance";
import { lireInterventionsSeance } from "./legacy-session-intervention-adapter";

function intervention(type: string, extra: Record<string, unknown> = {}) {
  return {
    id: `int-${type}`,
    type,
    label: `Geste ${type}`,
    source: { kind: "exercise", ref: "ex-1" },
    expectedEffect: "measurement",
    ...extra,
  };
}

describe("contrat canonique InterventionSeance", () => {
  it.each(INTERVENTION_TYPES)("accepte le type %s", (type) => {
    expect(parseInterventionSeance(intervention(type)).type).toBe(type);
  });

  it("centralise les trois effets", () => {
    expect(INTERVENTION_EFFECTS).toEqual(["measurement", "preparation", "support"]);
    expect(parseInterventionSeance(intervention("read", { expectedEffect: "preparation" })).expectedEffect)
      .toBe("preparation");
  });

  it("refuse un type invalide et un effet absent", () => {
    expect(() => parseInterventionSeance(intervention("exercise"))).toThrow(/type/);
    expect(() => parseInterventionSeance({
      ...intervention("read"),
      expectedEffect: undefined,
    })).toThrow(/expectedEffect/);
  });

  it("refuse deux identités identiques dans une séance", () => {
    expect(() => parseInterventionsSeance([
      intervention("read", { id: "same" }),
      intervention("explain", { id: "same" }),
    ])).toThrow(/identifiant unique/);
  });

  it("n'autorise aucune Observation implicite pour la préparation ou le soutien", () => {
    for (const expectedEffect of ["preparation", "support"] as const) {
      const geste = parseInterventionSeance(intervention("read", { expectedEffect }));
      expect(interventionPeutProduireObservation(geste, "completed")).toBe(false);
    }
  });

  it("ne produit aucune Observation après abandon", () => {
    const geste = parseInterventionSeance(intervention("resolve", {
      proofContract: {
        skillCodes: ["DEV-01"],
        protocolRef: "protocol:test",
        requiredArtifact: "validated-submission",
      },
    }));
    expect(interventionPeutProduireObservation(geste, "abandoned")).toBe(false);
  });

  it("lit un statut d'exécution sans le confondre avec une Observation", () => {
    expect(parseInterventionSeance(intervention("read", { statut: "completed" })).statut)
      .toBe("completed");
    expect(() => parseInterventionSeance(intervention("read", { statut: "done" })))
      .toThrow(/statut/);
  });
});

describe("lecture historique des séances", () => {
  it("adapte uniquement un exercice connu et réserve les types inconnus", () => {
    const lecture = lireInterventionsSeance({
      id: "ses-historique",
      activites: [
        { type: "exercice", ref: "ex-1", libelle: "Résoudre" },
        { type: "lecture", ref: "doc-1", libelle: "Lire" },
      ],
    });
    expect(lecture.origine).toBe("legacy");
    expect(lecture.interventions).toHaveLength(1);
    expect(lecture.interventions[0]).toMatchObject({
      id: "legacy-activity:ses-historique:0",
      type: "resolve",
      expectedEffect: "measurement",
    });
    expect(lecture.reserves[0]).toMatchObject({ type: "lecture", ref: "doc-1" });
  });

  it("ne replie pas une liste canonique invalide sur les anciennes activités", () => {
    const lecture = lireInterventionsSeance({
      id: "ses-invalide",
      activites: [{ type: "exercice", ref: "ex-1", libelle: "Ancien" }],
      interventions: [intervention("unknown") as never],
    });
    expect(lecture.origine).toBe("canonical");
    expect(lecture.interventions).toEqual([]);
    expect(lecture.reserves[0].type).toBe("interventions");
  });
});
