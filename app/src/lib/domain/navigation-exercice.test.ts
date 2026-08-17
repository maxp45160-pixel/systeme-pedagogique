import { describe, expect, it } from "vitest";
import { urlExercice, urlComposerAutonome } from "./navigation-exercice";

describe("urlExercice", () => {
  it("retombe sur le cahier pour un exercice sans séance", () => {
    expect(urlExercice("ex 1", undefined, "correction")).toBe("/seances");
  });

  it("construit une URL de workspace partageable", () => {
    expect(urlExercice("ex-1", { seanceId: "ses-1" }, "bilan"))
      .toBe("/seances?session=ses-1&exercice=ex-1&bilan=1");
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
