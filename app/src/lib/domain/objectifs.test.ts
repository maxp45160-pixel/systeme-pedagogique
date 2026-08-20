import { describe, expect, it } from "vitest";
import {
  motifRefusNouvelObjectif,
  transitionObjectifAutorisee,
  transitionParcoursAutorisee,
  type NouvelObjectif,
} from "./objectifs";

const objectif: NouvelObjectif = {
  formulation: "Comprendre les bases du raisonnement algorithmique.",
  cible: { type: "competence-locale", code: "DEV-01" },
  priorite: 4,
  horizon: "moyen-terme",
};

describe("objectifs du lot 4", () => {
  it("accepte une cible explicite locale", () => {
    expect(motifRefusNouvelObjectif(objectif)).toBeNull();
  });

  it("refuse les objectifs sans cible structurée", () => {
    expect(motifRefusNouvelObjectif({ ...objectif, cible: undefined as never })).toMatch(/cible/i);
  });

  it("refuse une cible ambiguë portant plusieurs références", () => {
    expect(motifRefusNouvelObjectif({
      ...objectif,
      cible: { type: "competence-locale", code: "DEV-01", domaineId: "algo" } as never,
    })).toMatch(/exactement|seule/i);
  });

  it("borne la priorité déclarée", () => {
    expect(motifRefusNouvelObjectif({ ...objectif, priorite: 6 })).toMatch(/priorité/i);
  });

  it("autorise seulement les transitions métier prévues", () => {
    expect(transitionObjectifAutorisee("actif", "atteint")).toBe(true);
    expect(transitionObjectifAutorisee("atteint", "actif")).toBe(false);
    expect(transitionParcoursAutorisee("actif", "termine")).toBe(true);
    expect(transitionParcoursAutorisee("termine", "actif")).toBe(false);
  });
});
