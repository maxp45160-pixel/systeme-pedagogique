import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Champ } from "./champ";

describe("Champ avec formules", () => {
  it("conserve la textarea et ajoute l'aperçu du même contenu", () => {
    const html = renderToStaticMarkup(createElement(Champ, {
      label: "Brief",
      multiligne: true,
      formules: true,
      value: "Calculer \\(x^2\\)",
      onChange: () => undefined,
      rows: 3,
    }));

    expect(html).toContain("<textarea");
    expect(html).toContain("Aperçu");
    expect(html).toContain('role="math"');
    expect(html).toContain("katex");
  });
});
