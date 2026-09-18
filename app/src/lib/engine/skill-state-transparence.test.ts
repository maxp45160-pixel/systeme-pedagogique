import { describe, expect, it } from "vitest";
import { REFERENTIEL_TEST } from "@/lib/domain/referentiel.fixture";
import type { SkillObservation } from "@/lib/domain/types";
import { computeSkillState } from "./skill-state";

const competence = REFERENTIEL_TEST.actifs[0];
const maintenant = new Date("2026-09-17T12:00:00Z");
const observation: SkillObservation = {
  id: "observation-synthetique", skillCode: competence.code,
  date: "2026-09-16T12:00:00Z", type: "exercice", niveauObservation: "A",
  autonomie: "A3", qualite: "moyenne", resultat: "reussi", contexte: "Explication synthétique",
  dimensions: { comprehension: 1, justification: 1 },
  source: { kind: "exercice", ref: "ex-synthetique" },
};

describe("explication d'une mesure partielle", () => {
  it("ne présente pas une dimension absente comme un zéro observé", () => {
    const etat = computeSkillState(competence, [observation], maintenant);
    for (const libelle of ["application", "transfert", "integration"]) {
      expect(etat.explication.facteurs.find((f) => f.libelle === libelle)?.valeur).toBe("non observée");
    }
    expect(etat.explication.reserves.some((r) => r.includes("dimensions non observées"))).toBe(true);
  });

  it("conserve le zéro lorsqu'une observation l'établit explicitement", () => {
    const etat = computeSkillState(competence, [{ ...observation, dimensions: { ...observation.dimensions, application: 0 } }], maintenant);
    expect(etat.explication.facteurs.find((f) => f.libelle === "application")?.valeur).toBe("0.00");
  });

  it("ne signale pas de couverture incomplète si les cinq dimensions sont observées", () => {
    const etat = computeSkillState(competence, [{ ...observation, dimensions: { comprehension: 1, application: 0, transfert: 0, integration: 0, justification: 1 } }], maintenant);
    expect(etat.explication.reserves.some((r) => r.includes("dimensions non observées"))).toBe(false);
  });
});
