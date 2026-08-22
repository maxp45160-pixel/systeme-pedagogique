import { describe, expect, it } from "vitest";
import { separerSujets } from "./sujets";

describe("separerSujets", () => {
  it("rend un seul sujet quand rien ne sépare", () => {
    expect(separerSujets("la macroéconomie")).toEqual(["la macroéconomie"]);
  });

  it("sépare sur les virgules et nettoie les espaces", () => {
    expect(separerSujets("macroéconomie, statistiques , développement web")).toEqual([
      "macroéconomie",
      "statistiques",
      "développement web",
    ]);
  });

  it("sépare sur le « et » isolé, jamais à l'intérieur d'un mot", () => {
    expect(separerSujets("droit fiscal et éthique")).toEqual(["droit fiscal", "éthique"]);
    expect(separerSujets("l'éthique des affaires")).toEqual(["l'éthique des affaires"]);
  });

  it("sépare sur les retours à la ligne et les points-virgules", () => {
    expect(separerSujets("philosophie morale\nluthérie; droit du travail")).toEqual([
      "philosophie morale",
      "luthérie",
      "droit du travail",
    ]);
  });

  it("ignore les fragments vides ou trop courts", () => {
    expect(separerSujets(", , philosophie,")).toEqual(["philosophie"]);
    expect(separerSujets("")).toEqual([]);
  });
});
