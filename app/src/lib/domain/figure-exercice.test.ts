import { describe, expect, it } from "vitest";
import { estFigureExercice } from "./figure-exercice";

describe("contrat FigureExercice", () => {
  it("accepte une image décrite et dimensionnée", () => {
    expect(estFigureExercice({
      type: "image",
      source: "/supports/schema.png",
      alt: "Schéma des échanges",
      legende: "Figure 1 — Échanges entre les composants.",
      largeur: 640,
      hauteur: 360,
    })).toBe(true);
  });

  it("refuse une source ou une alternative absente", () => {
    expect(estFigureExercice({ type: "image", source: "", alt: "Schéma" })).toBe(false);
    expect(estFigureExercice({ type: "image", source: "/schema.png", alt: "" })).toBe(false);
  });
});
