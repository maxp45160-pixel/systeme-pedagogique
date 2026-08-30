import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FigureExercice } from "./figure-exercice";

describe("FigureExercice", () => {
  it("rend une figure responsive avec alternative, dimensions et légende", () => {
    const html = renderToStaticMarkup(createElement(FigureExercice, {
      figure: {
        type: "image",
        source: "/supports/schema.png",
        alt: "Schéma des échanges",
        legende: "Figure 1 — Échanges entre les composants.",
        largeur: 640,
        hauteur: 360,
      },
    }));

    expect(html).toContain("figure-exercice");
    expect(html).toContain('src="/supports/schema.png"');
    expect(html).toContain('alt="Schéma des échanges"');
    expect(html).toContain('width="640"');
    expect(html).toContain('height="360"');
    expect(html).toContain("<figcaption");
    expect(html).toContain("Figure 1");
  });

  it("annonce proprement une figure sans source", () => {
    const html = renderToStaticMarkup(createElement(FigureExercice, {
      figure: { type: "image", source: "", alt: "Schéma absent", legende: "Figure non fournie" },
    }));

    expect(html).toContain("Illustration indisponible.");
    expect(html).toContain('role="img"');
    expect(html).toContain("Figure non fournie");
    expect(html).not.toContain("<img");
  });
});
