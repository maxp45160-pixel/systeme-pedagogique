import { describe, expect, it } from "vitest";
import {
  compterTentatives,
  estRetirable,
  modeRetraitExercice,
  usageExercice,
} from "./exercice";
import type { Exercise, ExerciseAttempt } from "./types";

/*
 * Cycle de vie d'un exercice — calque d'ADR-027 (02/08/2026).
 *
 * Ces cas protègent la même garantie que `modeRetrait` pour les compétences :
 * ce qui ne porte aucune trace s'efface, ce qui en porte s'archive, et le geste
 * est DÉRIVÉ, jamais offert au choix.
 */

let n = 0;
function tent(
  exerciseId: string,
  options: {
    resultat?: ExerciseAttempt["resultat"];
    statut?: ExerciseAttempt["statut"];
  } = {},
): ExerciseAttempt {
  return {
    id: `at-${++n}`,
    exerciseId,
    debut: "2026-08-01T10:00:00.000Z",
    fin: "2026-08-01T10:30:00.000Z",
    dureeMin: 30,
    indicesUtilises: 0,
    reponse: "…",
    autoEvaluation: {},
    resultat: options.resultat ?? "partiel",
    statut: options.statut ?? "terminee",
  };
}

function exo(options: Partial<Exercise> = {}): Exercise {
  return {
    id: "ex-1",
    titre: "Exercice",
    domaine: "developpement",
    type: "application",
    difficulte: 2,
    competences: ["DEV-01"],
    dureeEstimeeMin: 25,
    enonce: "…",
    indices: [],
    correction: "…",
    criteres: [],
    origine: "tuteur",
    ...options,
  };
}

describe("modeRetraitExercice", () => {
  it("efface franchement ce qui n'a jamais été tenté", () => {
    expect(modeRetraitExercice(0)).toBe("suppression");
  });

  it("archive dès la première tentative — une trace ne disparaît pas", () => {
    expect(modeRetraitExercice(1)).toBe("archivage");
    expect(modeRetraitExercice(12)).toBe("archivage");
  });
});

describe("compterTentatives", () => {
  it("compte les abandons aussi : ils figurent au journal", () => {
    // Contrairement à la calibration, qui les écarte parce qu'ils ne MESURENT
    // rien. Ici la question n'est pas « qu'a-t-on mesuré ? » mais « reste-t-il
    // une trace ? » — et une entrée de journal cite l'exercice par son titre.
    const tentatives = [
      tent("ex-1", { statut: "abandonnee" }),
      tent("ex-1", { statut: "en-cours" }),
      tent("ex-2"),
    ];
    expect(compterTentatives("ex-1", tentatives)).toBe(2);
    expect(compterTentatives("ex-2", tentatives)).toBe(1);
    expect(compterTentatives("ex-3", tentatives)).toBe(0);
  });
});

describe("estRetirable", () => {
  it("refuse les exercices livrés avec le logiciel", () => {
    expect(estRetirable(exo({ origine: "seed" }))).toBe(false);
    expect(estRetirable(exo({ diagnostic: true }))).toBe(false);
  });

  it("accepte ceux qui appartiennent au compte", () => {
    expect(estRetirable(exo({ origine: "tuteur" }))).toBe(true);
    expect(estRetirable(exo({ origine: "manuel" }))).toBe(true);
  });
});

describe("usageExercice", () => {
  it("« à faire » sans aucune tentative", () => {
    expect(usageExercice("ex-1", [])).toBe("a-faire");
  });

  it("« en cours » prime sur tout le reste", () => {
    const tentatives = [
      tent("ex-1", { resultat: "reussi" }),
      tent("ex-1", { statut: "en-cours" }),
    ];
    expect(usageExercice("ex-1", tentatives)).toBe("en-cours");
  });

  it("« acquis » dès une réussite terminée, même ancienne", () => {
    const tentatives = [
      tent("ex-1", { resultat: "reussi" }),
      tent("ex-1", { resultat: "echec" }),
    ];
    expect(usageExercice("ex-1", tentatives)).toBe("acquis");
  });

  it("« travaillé » quand des tentatives terminées existent sans réussite", () => {
    expect(usageExercice("ex-1", [tent("ex-1", { resultat: "echec" })])).toBe("travaille");
  });

  it("un abandon seul ne fait pas sortir de « à faire »", () => {
    expect(usageExercice("ex-1", [tent("ex-1", { statut: "abandonnee" })])).toBe("a-faire");
  });
});
