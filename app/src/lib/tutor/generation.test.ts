/**
 * Ce que ces tests protègent.
 *
 * `construirePromptGeneration` est la couture entre le 3ᵉ maillon de la boucle
 * (`lib/engine/calibration.ts`) et le tuteur. Si la difficulté conseillée
 * n'arrive pas dans le prompt, la génération redevient ce qu'elle était avant
 * ADR-028 : un modèle qui choisit la difficulté à vue.
 *
 * Le cas le plus important est le second : quand `calibrer` ne conclut pas, le
 * prompt doit le DIRE, pas inventer un nombre. C'est P2 à la couture — un
 * chiffre plausible glissé ici serait indiscernable d'une mesure.
 */

import { describe, expect, it } from "vitest";

import { construirePromptGeneration } from "./generation";
import type { Calibration } from "@/lib/engine/calibration";
import type { Referentiel, Skill } from "@/lib/domain/types";

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const LOG_10 = {
  code: "LOG-10",
  intitule: "Analyser un flux logistique",
  domaine: "logistique",
} as unknown as Skill;

const DEV_03 = {
  code: "DEV-03",
  intitule: "Filtrer et transformer une collection",
  domaine: "developpement",
} as unknown as Skill;

const REFERENTIEL: Referentiel = {
  domaines: [
    { id: "logistique", nom: "Logistique", prefixe: "LOG", description: "" },
    { id: "developpement", nom: "Développement", prefixe: "DEV", description: "" },
    { id: "dormant", nom: "Dormant", prefixe: "DOR", description: "" },
  ],
  skills: [LOG_10, DEV_03],
  actifs: [LOG_10, DEV_03],
} as unknown as Referentiel;

function calibration(surcharge: Partial<Calibration> = {}): Calibration {
  return {
    skillCode: "LOG-10",
    difficulteConseillee: 3,
    signal: "calibre",
    dimensionFaible: null,
    verdicts: [],
    explication: { resume: "", facteurs: [], nombrePreuves: 0, reserves: [] },
    ...surcharge,
  };
}

/* ------------------------------------------------------------------ */
/* La difficulté                                                       */
/* ------------------------------------------------------------------ */

describe("construirePromptGeneration — la difficulté conseillée", () => {
  it("porte la difficulté dérivée jusqu'au prompt", () => {
    const prompt = construirePromptGeneration(REFERENTIEL, [
      { competence: LOG_10, calibration: calibration({ difficulteConseillee: 4 }) },
    ]);
    expect(prompt).toContain("LOG-10");
    expect(prompt).toContain("difficulté 4");
  });

  it("retire la difficulté de l'appréciation du modèle, explicitement", () => {
    const prompt = construirePromptGeneration(REFERENTIEL, [
      { competence: LOG_10, calibration: calibration() },
    ]);
    expect(prompt).toContain("N'EST PAS À TON APPRÉCIATION");
  });

  /*
   * Le cas de P2. `calibrer` rend `null` quand aucune tentative n'est
   * exploitable — toutes abandonnées sous 25 % de la durée estimée, par
   * exemple. Le prompt doit refléter cette absence, et surtout ne pas porter
   * un nombre que rien n'étaye.
   */
  it("ne conseille aucun nombre quand la calibration ne conclut pas", () => {
    const prompt = construirePromptGeneration(REFERENTIEL, [
      { competence: LOG_10, calibration: calibration({ difficulteConseillee: null }) },
    ]);
    expect(prompt).toContain("aucune tentative exploitable");
    expect(prompt).not.toMatch(/difficulté [1-5]/);
  });

  it("dit la même chose quand il n'y a aucune calibration du tout", () => {
    const prompt = construirePromptGeneration(REFERENTIEL, [
      { competence: LOG_10, calibration: null },
    ]);
    expect(prompt).toContain("aucune tentative exploitable");
    expect(prompt).not.toMatch(/difficulté [1-5]/);
  });
});

/* ------------------------------------------------------------------ */
/* L'angle                                                             */
/* ------------------------------------------------------------------ */

describe("construirePromptGeneration — la dimension faible", () => {
  it("transmet l'angle à travailler quand il est mesuré", () => {
    const prompt = construirePromptGeneration(REFERENTIEL, [
      {
        competence: LOG_10,
        calibration: calibration({
          dimensionFaible: { dimension: "application", moyenne: 0.4, observations: 2 },
        }),
      },
    ]);
    expect(prompt).toContain("Application");
  });

  it("n'invente aucun angle quand aucune dimension ne ressort", () => {
    const prompt = construirePromptGeneration(REFERENTIEL, [
      { competence: LOG_10, calibration: calibration({ dimensionFaible: null }) },
    ]);
    expect(prompt).not.toContain("dimension «");
  });
});

/* ------------------------------------------------------------------ */
/* Le périmètre                                                        */
/* ------------------------------------------------------------------ */

describe("construirePromptGeneration — les domaines", () => {
  it("ne liste que les domaines portant au moins une compétence active", () => {
    const prompt = construirePromptGeneration(REFERENTIEL, [
      { competence: LOG_10, calibration: calibration() },
    ]);
    expect(prompt).toContain("logistique");
    expect(prompt).toContain("developpement");
    // Un domaine sans compétence active ne doit pas entrer dans l'`enum` du
    // schéma : un exercice y serait rattaché sans rien à mesurer.
    expect(prompt).not.toContain("dormant");
  });

  it("le dit plutôt que de laisser la liste vide quand rien n'est actif", () => {
    const vide = { ...REFERENTIEL, actifs: [] } as unknown as Referentiel;
    const prompt = construirePromptGeneration(vide, [
      { competence: LOG_10, calibration: calibration() },
    ]);
    expect(prompt).toContain("aucun");
  });
});

/* ------------------------------------------------------------------ */
/* Plusieurs demandes                                                  */
/* ------------------------------------------------------------------ */

describe("construirePromptGeneration — plusieurs compétences", () => {
  it("porte une ligne de calibrage par compétence demandée", () => {
    const prompt = construirePromptGeneration(REFERENTIEL, [
      { competence: LOG_10, calibration: calibration({ difficulteConseillee: 2 }) },
      {
        competence: DEV_03,
        calibration: calibration({ skillCode: "DEV-03", difficulteConseillee: 5 }),
      },
    ]);
    expect(prompt).toContain("LOG-10 — Analyser un flux logistique : difficulté 2");
    expect(prompt).toContain("DEV-03 — Filtrer et transformer une collection : difficulté 5");
  });
});
