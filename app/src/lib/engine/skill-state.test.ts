import { describe, expect, it } from "vitest";
import { computeSkillState } from "./skill-state";
import { skillDeTest } from "@/lib/domain/referentiel.fixture";
import type { SkillObservation } from "@/lib/domain/types";

const maintenant = new Date("2026-08-21T12:00:00.000Z");

function observation(): SkillObservation {
  return {
    id: "obs-1",
    skillCode: "DEV-01",
    date: "2026-08-20T12:00:00.000Z",
    type: "exercice",
    niveauObservation: "A",
    autonomie: "A1",
    qualite: "moyenne",
    resultat: "reussi",
    contexte: "Contexte de test",
    dimensions: { comprehension: 0.8, application: 0.8 },
    source: { kind: "exercice", ref: "ex-1" },
  };
}

describe("prochaine étape contextualisée", () => {
  it("nomme la compétence au lieu d'afficher une consigne passe-partout", () => {
    const skill = skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0);
    const etat = computeSkillState(skill, [observation()], maintenant);

    expect(etat.niveau).toBe(2);
    expect(etat.prochaineEtape).toContain("Intitulé de DEV-01");
    expect(etat.prochaineEtape).not.toBe("Résoudre un problème standard sans indice pour démontrer l'autonomie.");
  });
});
