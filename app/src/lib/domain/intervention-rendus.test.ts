import { describe, expect, it } from "vitest";
import { INTERVENTION_TYPES } from "./intervention-seance";
import {
  REGISTRE_RENDUS_INTERVENTIONS,
  consigneDeterministeIntervention,
  renduPourIntervention,
  messageFinIntervention,
  typesCouvertsParLeRegistre,
} from "./intervention-rendus";

describe("registre des rendus d'interventions", () => {
  it("couvre exactement le vocabulaire canonique", () => {
    expect(Object.keys(REGISTRE_RENDUS_INTERVENTIONS).sort()).toEqual([...INTERVENTION_TYPES].sort());
    expect(typesCouvertsParLeRegistre()).toEqual(INTERVENTION_TYPES);
  });

  it.each(INTERVENTION_TYPES)("associe %s à un chemin unique", (type) => {
    expect(renduPourIntervention({ type })).toMatchObject({ type });
  });

  it("annonce l'absence de mesure pour préparation et soutien", () => {
    expect(messageFinIntervention({
      id: "i-read",
      type: "read",
      label: "Lire",
      source: { kind: "document", ref: "doc-1" },
      expectedEffect: "preparation",
    })).toMatch(/aucune nouvelle mesure/);
    expect(messageFinIntervention({
      id: "i-help",
      type: "ask-for-help",
      label: "Aide",
      source: { kind: "declared-need", ref: "need-1" },
      expectedEffect: "support",
    })).toMatch(/aucune nouvelle mesure/);
  });

  it("réutilise les consignes Feynman et rappel déterministes quand les faits sont complets", () => {
    const expliquer = {
      id: "i-explain",
      type: "explain" as const,
      label: "Les invariants",
      estimatedDurationMinutes: 10,
      source: { kind: "course" as const, ref: "cours-1" },
      expectedEffect: "preparation" as const,
      targetSkillCodes: ["DEV-01"],
    };
    const rappeler = { ...expliquer, id: "i-recall", type: "recall" as const };
    expect(consigneDeterministeIntervention(expliquer)).toMatch(/Méthode Feynman/);
    expect(consigneDeterministeIntervention(rappeler)).toMatch(/Mémoire active/);
    expect(consigneDeterministeIntervention({ ...expliquer, estimatedDurationMinutes: undefined })).toBeUndefined();
  });
});
