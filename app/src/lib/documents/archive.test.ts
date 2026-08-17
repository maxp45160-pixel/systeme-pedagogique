import { describe, it, expect } from "vitest";
import { validerTailleMarkdown } from "./archive";

describe("garde-fou de taille des fiches Markdown", () => {
  it("accepte une fiche non vide sous la limite", () => {
    expect(() => validerTailleMarkdown("# Titre\n\nDu contenu.")).not.toThrow();
  });

  it("refuse une fiche vide ou blanche", () => {
    expect(() => validerTailleMarkdown("")).toThrow("vide");
    expect(() => validerTailleMarkdown("   \n  ")).toThrow("vide");
  });

  it("refuse une fiche au-delà de 2 Mo", () => {
    expect(() => validerTailleMarkdown("a".repeat(2_000_001))).toThrow("2 Mo");
  });
});
