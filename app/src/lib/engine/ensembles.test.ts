import { describe, expect, it } from "vitest";
import { ensemblesProposes, pairesObservees } from "./ensembles";
import { REFERENTIEL_TEST } from "@/lib/domain/referentiel.fixture";
import type { Theme } from "@/lib/domain/theme";
import type {
  Difficulte,
  Exercise,
  LearningSession,
  SkillEvidence,
} from "@/lib/domain/types";

/*
 * Ce que ces tests protègent : la règle anti-circularité.
 *
 * Une séance composée en choisissant cinq compétences ne révèle pas qu'elles
 * vont ensemble — elle répète ce que la personne a déclaré. Une proposition
 * exige donc deux sources DISTINCTES. Sans cette règle, le système rendrait à
 * l'utilisateur sa propre déclaration en la présentant comme une découverte.
 */

const CODES_ACTIFS = REFERENTIEL_TEST.codesActifs;

let compteur = 0;

function seance(skillCodes: string[]): LearningSession {
  return {
    id: `ses-${++compteur}`,
    date: "2026-08-10T08:00:00.000Z",
    dureeMin: 30,
    domaines: ["developpement"],
    skillCodes,
    activites: [],
    genereAutomatiquement: false,
  };
}

function exercice(competences: string[], archive = false): Exercise {
  return {
    id: `ex-${++compteur}`,
    titre: "Exercice",
    domaine: "developpement",
    type: "application",
    difficulte: 2 as Difficulte,
    competences,
    dureeEstimeeMin: 20,
    enonce: "…",
    indices: [],
    correction: "…",
    criteres: [],
    origine: "seed",
    archive,
  };
}

function preuve(skill: string, combinees: string[], refExercice: string): SkillEvidence {
  return {
    id: `ev-${++compteur}`,
    skillCode: skill,
    date: "2026-08-10T08:00:00.000Z",
    type: "exercice",
    niveauPreuve: "A",
    autonomie: "A3",
    qualite: "moyenne",
    resultat: "reussi",
    contexte: "Contexte",
    dimensions: {},
    competencesCombinees: combinees,
    source: { kind: "exercice", ref: refExercice },
  };
}

function theme(codes: string[], archive = false): Theme {
  return {
    id: `theme-${++compteur}`,
    libelle: "Thème",
    codes,
    origine: "utilisateur",
    creeLe: "2026-08-01T08:00:00.000Z",
    archive,
  };
}

const base = { themes: [] as Theme[], referentiel: REFERENTIEL_TEST };

/* ------------------------------------------------------------------ */

describe("pairesObservees — compter des sources, pas des occurrences", () => {
  it("ne compte qu'une source pour les preuves d'un même exercice", () => {
    /*
      Un exercice à trois compétences écrit trois preuves qui se citent
      mutuellement. Les compter séparément ferait passer un seul travail pour
      trois observations concordantes.
    */
    const paires = pairesObservees({
      sessions: [],
      exercices: [],
      preuves: [
        preuve("DEV-01", ["DEV-02"], "ex-partage"),
        preuve("DEV-02", ["DEV-01"], "ex-partage"),
      ],
      codesRetenus: CODES_ACTIFS,
    });

    expect(paires).toHaveLength(1);
    expect(paires[0].sources).toHaveLength(1);
  });

  it("écarte les compétences hors périmètre", () => {
    // STAT-01 est inactive dans la fixture.
    const paires = pairesObservees({
      sessions: [seance(["DEV-01", "STAT-01"])],
      exercices: [],
      preuves: [],
      codesRetenus: CODES_ACTIFS,
    });

    expect(paires).toEqual([]);
  });

  it("ignore un exercice archivé : il ne relie plus rien", () => {
    const paires = pairesObservees({
      sessions: [],
      exercices: [exercice(["DEV-01", "DEV-02"], true)],
      preuves: [],
      codesRetenus: CODES_ACTIFS,
    });

    expect(paires).toEqual([]);
  });

  it("mélange les sources : une séance et un exercice font deux", () => {
    const paires = pairesObservees({
      sessions: [seance(["DEV-01", "DEV-02"])],
      exercices: [exercice(["DEV-01", "DEV-02"])],
      preuves: [],
      codesRetenus: CODES_ACTIFS,
    });

    expect(paires).toHaveLength(1);
    expect(paires[0].sources).toHaveLength(2);
  });
});

describe("ensemblesProposes — la règle anti-circularité", () => {
  it("ne propose RIEN à partir d'une seule séance, si riche soit-elle", () => {
    const resultat = ensemblesProposes({
      ...base,
      sessions: [seance(["DEV-01", "DEV-02", "DEV-03", "DEV-04"])],
      exercices: [],
      preuves: [],
    });

    expect(resultat.propositions).toEqual([]);
    // Mais il sait dire que le signal existe et qu'il est trop mince.
    expect(resultat.pairesTropMinces).toBeGreaterThan(0);
    expect(resultat.sourcesExaminees).toBe(1);
  });

  it("propose dès que deux travaux distincts concordent", () => {
    const resultat = ensemblesProposes({
      ...base,
      sessions: [seance(["DEV-01", "DEV-02"]), seance(["DEV-01", "DEV-02"])],
      exercices: [],
      preuves: [],
    });

    expect(resultat.propositions).toHaveLength(1);
    expect(resultat.propositions[0].codes).toEqual(["DEV-01", "DEV-02"]);
    expect(resultat.propositions[0].sources).toHaveLength(2);
  });

  it("fusionne les paires qui partagent une compétence", () => {
    const resultat = ensemblesProposes({
      ...base,
      sessions: [
        seance(["DEV-01", "DEV-02"]),
        seance(["DEV-01", "DEV-02"]),
        seance(["DEV-02", "DEV-03"]),
        seance(["DEV-02", "DEV-03"]),
      ],
      exercices: [],
      preuves: [],
    });

    expect(resultat.propositions).toHaveLength(1);
    expect(resultat.propositions[0].codes).toEqual(["DEV-01", "DEV-02", "DEV-03"]);
  });

  it("ne repropose pas un ensemble déjà couvert par un thème", () => {
    const resultat = ensemblesProposes({
      ...base,
      themes: [theme(["DEV-01", "DEV-02", "DEV-03"])],
      sessions: [seance(["DEV-01", "DEV-02"]), seance(["DEV-01", "DEV-02"])],
      exercices: [],
      preuves: [],
    });

    expect(resultat.propositions).toEqual([]);
  });

  it("repropose si le thème qui le couvrait est archivé", () => {
    const resultat = ensemblesProposes({
      ...base,
      themes: [theme(["DEV-01", "DEV-02"], true)],
      sessions: [seance(["DEV-01", "DEV-02"]), seance(["DEV-01", "DEV-02"])],
      exercices: [],
      preuves: [],
    });

    expect(resultat.propositions).toHaveLength(1);
  });

  it("chaque proposition porte le motif qui la fonde (P3)", () => {
    const resultat = ensemblesProposes({
      ...base,
      sessions: [seance(["DEV-01", "DEV-02"]), seance(["DEV-01", "DEV-02"])],
      exercices: [],
      preuves: [],
    });

    expect(resultat.propositions[0].motif).toContain("2 travaux distincts");
  });

  it("ne rend rien, et le dit, quand il n'y a aucun travail multi-compétences", () => {
    const resultat = ensemblesProposes({
      ...base,
      sessions: [seance(["DEV-01"])],
      exercices: [exercice(["DEV-02"])],
      preuves: [],
    });

    expect(resultat.propositions).toEqual([]);
    expect(resultat.sourcesExaminees).toBe(0);
    expect(resultat.pairesTropMinces).toBe(0);
  });

  it("classe le plus étayé en premier", () => {
    const resultat = ensemblesProposes({
      ...base,
      sessions: [
        seance(["DEV-01", "DEV-02"]),
        seance(["DEV-01", "DEV-02"]),
        seance(["DEV-01", "DEV-02"]),
        seance(["DEV-05", "DEV-06"]),
        seance(["DEV-05", "DEV-06"]),
      ],
      exercices: [],
      preuves: [],
    });

    expect(resultat.propositions).toHaveLength(2);
    expect(resultat.propositions[0].codes).toEqual(["DEV-01", "DEV-02"]);
    expect(resultat.propositions[0].sources).toHaveLength(3);
  });
});
