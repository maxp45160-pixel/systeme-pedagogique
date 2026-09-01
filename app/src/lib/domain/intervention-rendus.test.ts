import { describe, expect, it } from "vitest";
import { INTERVENTION_TYPES, interventionPeutProduireObservation } from "./intervention-seance";
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

  it("rend un exercice donné sans corrigé comme une préparation écrite", () => {
    expect(renduPourIntervention({
      type: "resolve",
      source: { kind: "document", ref: "td-1" },
      expectedEffect: "preparation",
    })).toMatchObject({ kind: "writing", observationPath: "none" });
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

  it("ne rend une intervention probante que si un contrat explicite est présent", () => {
    const production = {
      id: "i-produce",
      type: "produce" as const,
      label: "Produire une solution",
      source: { kind: "document" as const, ref: "doc-1" },
      expectedEffect: "measurement" as const,
    };
    expect(interventionPeutProduireObservation(production, "completed")).toBe(false);
    expect(messageFinIntervention(production)).toContain("contrat de preuve");

    const contrattee = {
      ...production,
      proofContract: {
        skillCodes: ["DEV-01"],
        protocolRef: "protocole-1",
        requiredArtifact: "production-relue",
      },
    };
    expect(interventionPeutProduireObservation(contrattee, "completed")).toBe(true);
    expect(messageFinIntervention(contrattee)).toContain("validation du contrat");
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
