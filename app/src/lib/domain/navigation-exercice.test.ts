import { describe, expect, it } from "vitest";
import { urlExercice } from "./navigation-exercice";

describe("urlExercice", () => {
  it("construit une URL autonome", () => {
    expect(urlExercice("ex 1", undefined, "correction"))
      .toBe("/exercices/ex%201?correction=1");
  });

  it("construit une URL de workspace partageable", () => {
    expect(urlExercice("ex-1", { seanceId: "ses-1" }, "bilan"))
      .toBe("/seances?session=ses-1&exercice=ex-1&bilan=1");
  });
});
