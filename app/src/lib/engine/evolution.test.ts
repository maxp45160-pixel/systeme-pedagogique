import { describe, expect, it } from "vitest";
import { evolutionScore, qualificatifScore } from "./evolution";
import { REFERENTIEL_TEST } from "@/lib/domain/referentiel.fixture";
import type { SkillObservation } from "@/lib/domain/types";

/*
 * Ce que ces tests protègent : la courbe est un rejeu fidèle du journal —
 * elle ne peut ni deviner un score sans observation, ni compter une première
 * mesure comme un palier franchi, ni fabriquer une variation là où deux
 * mesures distantes d'une semaine n'existent pas.
 */

const MAINTENANT = new Date("2026-08-15T10:00:00.000Z");
const SKILLS = REFERENTIEL_TEST.parCode;

let compteur = 0;

function observation(skill: string, date: string): SkillObservation {
  return {
    id: `obs-${++compteur}`,
    skillCode: skill,
    date,
    type: "exercice",
    niveauObservation: "A",
    autonomie: "A3",
    qualite: "moyenne",
    resultat: "reussi",
    contexte: `Contexte ${compteur}`,
    dimensions: { comprehension: 0.9, application: 0.85 },
    source: { kind: "exercice", ref: "ex-1" },
  };
}

describe("evolutionScore — le rejeu du journal", () => {
  it("ne rend aucun point sans observation", () => {
    const evolution = evolutionScore({ observations: [], skillsParCode: SKILLS, now: MAINTENANT });

    expect(evolution.points).toEqual([]);
    expect(evolution.variation7j).toBeNull();
    expect(evolution.franchissementsTotal).toBe(0);
    expect(evolution.premieresMesuresTotal).toBe(0);
  });

  it("commence à la première évaluation et compte la première mesure sans en faire un palier", () => {
    const evolution = evolutionScore({
      observations: [observation("DEV-01", "2026-08-14T09:00:00.000Z")],
      skillsParCode: SKILLS,
      now: MAINTENANT,
    });

    // Une première mesure (— → niveau) n'est PAS un palier franchi :
    // même règle strict que `croissance.ts`.
    expect(evolution.premieresMesuresTotal).toBe(1);
    expect(evolution.franchissementsTotal).toBe(0);
    expect(evolution.points).toHaveLength(1);
    expect(evolution.points[0].score).toBeGreaterThan(0);
  });

  it("ignore une observation hors référentiel au lieu d'inventer son état", () => {
    const evolution = evolutionScore({
      observations: [observation("INCONNU-99", "2026-08-14T09:00:00.000Z")],
      skillsParCode: SKILLS,
      now: MAINTENANT,
    });

    expect(evolution.points).toEqual([]);
  });

  it("fait monter la courbe quand une montée de palier déplace le score", () => {
    const avant = evolutionScore({
      observations: [observation("DEV-01", "2026-08-01T09:00:00.000Z")],
      skillsParCode: SKILLS,
      now: MAINTENANT,
    });

    const apres = evolutionScore({
      observations: [
        observation("DEV-01", "2026-08-01T09:00:00.000Z"),
        observation("DEV-01", "2026-08-10T09:00:00.000Z"),
        observation("DEV-01", "2026-08-13T09:00:00.000Z"),
        observation("DEV-02", "2026-08-14T09:00:00.000Z"),
      ],
      skillsParCode: SKILLS,
      now: MAINTENANT,
    });

    expect(apres.franchissementsTotal).toBeGreaterThanOrEqual(avant.franchissementsTotal);
    expect(apres.points.at(-1)!.score).toBeGreaterThanOrEqual(avant.points[0].score);
    // Chaque point daté : la courbe reste une suite chronologique.
    const dates = apres.points.map((p) => p.date);
    expect([...dates].sort()).toEqual(dates);
  });

  it("refuse une variation sur 7 jours sans mesure assez ancienne pour la porter", () => {
    const evolution = evolutionScore({
      observations: [observation("DEV-01", "2026-08-14T09:00:00.000Z")],
      skillsParCode: SKILLS,
      now: MAINTENANT,
    });

    // Une seule mesure, vieille d'un jour : comparer, c'est inventer.
    expect(evolution.variation7j).toBeNull();
  });

  it("calcule la variation quand deux mesures sont distantes d'au moins 7 jours", () => {
    const evolution = evolutionScore({
      observations: [
        observation("DEV-01", "2026-07-01T09:00:00.000Z"),
        observation("DEV-02", "2026-08-14T09:00:00.000Z"),
      ],
      skillsParCode: SKILLS,
      now: MAINTENANT,
    });

    expect(evolution.variation7j).not.toBeNull();
  });
});

describe("qualificatifScore — la conversion parlante du score", () => {
  it("lit trois registres, déterministes et sans état", () => {
    expect(qualificatifScore(0)).toBe("En construction");
    expect(qualificatifScore(39)).toBe("En construction");
    expect(qualificatifScore(40)).toBe("En consolidation");
    expect(qualificatifScore(69)).toBe("En consolidation");
    expect(qualificatifScore(70)).toBe("Solide");
    expect(qualificatifScore(100)).toBe("Solide");
  });
});
