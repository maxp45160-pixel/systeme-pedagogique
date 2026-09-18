import { describe, expect, it } from "vitest";
import { computeSkillState } from "./skill-state";
import { skillDeTest } from "@/lib/domain/referentiel.fixture";
import type { SkillObservation } from "@/lib/domain/types";
import { estMaitrisee } from "./maitrise";

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

describe("chronologie des observations et régression", () => {
  const skill = skillDeTest("DEV-01", "developpement", "fondamentaux", 1, 0);
  function preuve(id: string, date: string, resultat: SkillObservation["resultat"] = "reussi"): SkillObservation {
    return {
      ...observation(), id, date, resultat, autonomie: "A3", contexte: id,
      familleSituation: { cle: id, libelle: id, derivee: true },
      dimensions: resultat === "reussi"
        ? { comprehension: 1, application: 1, transfert: 0.8 }
        : { comprehension: 0.2, application: 0.2, transfert: 0.1 },
    };
  }
  const acquises = [
    preuve("acquise-a", "2026-08-17T12:00:00.000Z"),
    preuve("acquise-b", "2026-08-18T12:00:00.000Z"),
  ];

  it("ne laisse ni l'ordre reçu ni l'identifiant départager une régression à date identique", () => {
    for (const idReussite of ["a-reussite", "z-reussite"]) {
      const groupe = [
        preuve(idReussite, "2026-08-20T12:00:00.000Z"),
        preuve("echec-a", "2026-08-20T12:00:00.000Z", "echec"),
        preuve("echec-b", "2026-08-20T12:00:00.000Z", "echec"),
      ];
      const permutations = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
      let reference: ReturnType<typeof computeSkillState> | undefined;
      for (const ordre of permutations) {
        const entree = [...acquises, ...ordre.map((index) => groupe[index])];
        const avant = structuredClone(entree);
        const etat = computeSkillState(skill, entree, maintenant);
        expect(etat.niveau).toBe(4);
        expect(etat.contradictions).toHaveLength(2);
        expect(etat.confiance).toBe("moyenne");
        expect(estMaitrisee(etat)).toBe(true);
        expect(etat.explication.reserves.join(" ")).toContain("ordre");
        expect(etat.explication.reserves.join(" ")).toContain("non établi");
        if (reference) expect(etat).toEqual(reference);
        reference = etat;
        expect(entree).toEqual(avant);
      }
    }
  });

  it("inspecte tout le groupe ex aequo à la frontière de l'avant-dernière observation", () => {
    const etat = computeSkillState(skill, [
      ...acquises,
      preuve("a-reussite", "2026-08-19T12:00:00.000Z"),
      preuve("z-echec", "2026-08-19T12:00:00.000Z", "echec"),
      preuve("dernier-echec", "2026-08-20T12:00:00.000Z", "echec"),
    ], maintenant);
    expect(etat.niveau).toBe(4);
    expect(etat.explication.reserves.join(" ")).toContain("non établi");
  });

  it("classe les instants réels avant leur représentation de fuseau horaire", () => {
    const etat = computeSkillState(skill, [
      ...acquises,
      // 12 h UTC, donc AVANT les deux échecs malgré le libellé 15 h.
      preuve("reussite", "2026-08-20T15:00:00+03:00"),
      preuve("echec-a", "2026-08-20T13:00:00Z", "echec"),
      preuve("echec-b", "2026-08-20T14:00:00Z", "echec"),
    ], maintenant);
    expect(etat.niveau).toBe(3);
    expect(etat.derniereObservation).toBe("2026-08-20T14:00:00Z");
    expect(etat.explication.reserves.join(" ")).not.toContain("non établi");
  });

  it("reconnaît les dates équivalentes même quand leur écriture diffère", () => {
    const etat = computeSkillState(skill, [
      ...acquises,
      preuve("a-reussite", "2026-08-20T12:00:00Z"),
      preuve("echec-a", "2026-08-20T14:00:00+02:00", "echec"),
      preuve("echec-b", "2026-08-20T13:00:00+01:00", "echec"),
    ], maintenant);
    expect(etat.niveau).toBe(4);
    expect(etat.explication.reserves.join(" ")).toContain("non établi");
  });

  it.each([false, true])("conserve la baisse pour deux échecs autonomes non ambigus (simultanés : %s)", (simultanes) => {
    const etat = computeSkillState(skill, [
      ...acquises,
      preuve("echec-a", "2026-08-19T12:00:00.000Z", "echec"),
      preuve("echec-b", simultanes ? "2026-08-19T12:00:00.000Z" : "2026-08-20T12:00:00.000Z", "echec"),
    ], maintenant);
    expect(etat.niveau).toBe(3);
    expect(etat.explication.reserves.join(" ")).toContain("Niveau abaissé");
    expect(etat.explication.reserves.join(" ")).not.toContain("non établi");
  });

  it("ne remplace pas la garde de trois observations ni le plancher d'autonomie A2", () => {
    const premierEchec = preuve("echec-a", "2026-08-19T12:00:00.000Z", "echec");
    const secondEchec = preuve("echec-b", "2026-08-20T12:00:00.000Z", "echec");
    const deuxSeulement = computeSkillState(skill, [premierEchec, secondEchec], maintenant);
    expect(deuxSeulement.explication.reserves.join(" ")).not.toContain("Niveau abaissé");
    const avecAide = computeSkillState(skill, [
      ...acquises, premierEchec, { ...secondEchec, autonomie: "A1" },
    ], maintenant);
    expect(avecAide.niveau).toBe(4);
  });
});
