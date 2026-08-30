import { describe, expect, it } from "vitest";
import { rendreFormule } from "./rendu-formule";

describe("rendreFormule", () => {
  it("compose une formule inline avec KaTeX", () => {
    const rendu = rendreFormule("x^2 + 1");

    expect(rendu.html).toContain("katex");
    expect(rendu.texteAccessible).toBe("x² + 1");
  });

  it("compose un bloc avec le mode display", () => {
    expect(rendreFormule("\\frac{a}{b}", true).html).toContain("katex-display");
  });

  it("retombe sur un texte accessible si la syntaxe est refusée", () => {
    const rendu = rendreFormule("\\commandeInconnue{x}");

    expect(rendu.html).toBeNull();
    expect(rendu.texteAccessible).not.toBe("");
    expect(rendu.texteAccessible).toContain("x");
  });
});
