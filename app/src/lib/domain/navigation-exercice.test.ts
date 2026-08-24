import { describe, expect, it } from "vitest";
import { urlExercice, urlComposerAutonome, urlPremierTest } from "./navigation-exercice";

describe("urlExercice", () => {
  it("retombe sur le cahier pour un exercice sans séance", () => {
    expect(urlExercice("ex 1", undefined, "evaluer")).toBe("/seances");
  });

  it("construit une URL de workspace partageable", () => {
    expect(urlExercice("ex-1", { seanceId: "ses-1" }, "bilan"))
      .toBe("/seances?session=ses-1&exercice=ex-1&bilan=1");
  });
});

describe("urlPremierTest", () => {
  it("ouvre un seul test express sur l'axe retenu", () => {
    expect(urlPremierTest("STAT 01"))
      .toBe("/seances?composer=1&amorce=1&temps=5&code=STAT+01");
  });

  it("laisse le serveur choisir la première cible si aucun code n'est rendu", () => {
    expect(urlPremierTest()).toBe("/seances?composer=1&amorce=1&temps=5");
  });
});

describe("urlComposerAutonome", () => {
  it("préremplit le compositeur avec le code et la durée", () => {
    expect(urlComposerAutonome("DEB-01", 25))
      .toBe("/seances?composer=1&code=DEB-01&temps=25");
  });

  it("sans code, ouvre le compositeur sans cible imposée", () => {
    expect(urlComposerAutonome(undefined, undefined)).toBe("/seances?composer=1&temps=45");
  });
});
