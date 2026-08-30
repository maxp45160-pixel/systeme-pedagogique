import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FormuleMath } from "./formule-math";

describe("FormuleMath", () => {
  it("annonce une formule inline sans exposer le HTML KaTeX au lecteur d'écran", () => {
    const html = renderToStaticMarkup(createElement(FormuleMath, { latex: "x^2" }));

    expect(html).toContain('role="math"');
    expect(html).toContain('aria-label="x²"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("katex");
  });

  it("conserve la composition d'un bloc", () => {
    const html = renderToStaticMarkup(createElement(FormuleMath, { latex: "\\sum_{i=1}^{n} i", display: true }));

    expect(html).toContain("formule-rendu-bloc");
    expect(html).toContain("katex-display");
  });

  it("rend une syntaxe invalide lisible sans message technique", () => {
    const html = renderToStaticMarkup(createElement(FormuleMath, { latex: "\\commandeInconnue{x}" }));

    expect(html).toContain('class="formule"');
    expect(html).toContain('role="math"');
    expect(html).toContain("x");
    expect(html).not.toContain("KaTeX");
  });
});
