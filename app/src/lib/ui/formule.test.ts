import { describe, expect, it } from "vitest";
import { latexVersTexte, segmenterFormulesEnLigne } from "./formule";

describe("latexVersTexte", () => {
  it("rend lisible la formule du stock de sécurité — le cas remonté à l'usage", () => {
    const source =
      "SS = Z \\times \\sqrt{(\\mu_d \\times \\sigma_L^2) + (\\mu_L \\times \\sigma_d^2)}";
    expect(latexVersTexte(source)).toBe("SS = Z × √((μ_d × σ_L²) + (μ_L × σ_d²))");
  });

  it("développe une fraction en division parenthésée", () => {
    expect(latexVersTexte("\\frac{a + b}{2}")).toBe("(a + b) / (2)");
  });

  it("résout les commandes imbriquées de l'intérieur vers l'extérieur", () => {
    expect(latexVersTexte("\\sqrt{\\frac{\\sigma^2}{n}}")).toBe("√((σ²) / (n))");
  });

  it("traduit les racines d'indice 3 et 4", () => {
    expect(latexVersTexte("\\sqrt[3]{x}")).toBe("∛(x)");
  });

  it("laisse en notation `_` un indice sans équivalent Unicode", () => {
    // « L » n'a pas d'indice Unicode : mieux vaut « σ_L » que « σL », ambigu.
    expect(latexVersTexte("\\sigma_L")).toBe("σ_L");
    expect(latexVersTexte("x_1")).toBe("x₁");
  });

  it("efface les délimiteurs extensibles et les espacements", () => {
    expect(latexVersTexte("\\left( x \\right)\\quad y")).toBe("( x ) y");
  });

  it("garde le contenu de \\text{} et jette la commande", () => {
    expect(latexVersTexte("\\text{demande} \\times \\text{délai}")).toBe("demande × délai");
  });

  it("ne rend jamais vide une formule qu'il ne couvre pas", () => {
    const exotique = "\\begin{pmatrix} a & b \\end{pmatrix}";
    const rendu = latexVersTexte(exotique);
    expect(rendu).not.toBe("");
    expect(rendu).toContain("a & b");
  });

  it("ne bloque pas sur une accolade jamais fermée — flux SSE tronqué", () => {
    expect(latexVersTexte("\\sqrt{x + ")).toBe("√x +");
  });
});

describe("segmenterFormulesEnLigne", () => {
  it("isole une formule \\( … \\) au milieu de la prose", () => {
    expect(segmenterFormulesEnLigne("On pose \\(\\mu_d\\) puis on conclut.")).toEqual([
      { formule: false, texte: "On pose " },
      { formule: true, texte: "μ_d" },
      { formule: false, texte: " puis on conclut." },
    ]);
  });

  it("accepte $ … $ quand le contenu porte une marque de notation", () => {
    expect(segmenterFormulesEnLigne("soit $\\sigma^2$ ici")).toEqual([
      { formule: false, texte: "soit " },
      { formule: true, texte: "σ²" },
      { formule: false, texte: " ici" },
    ]);
  });

  it("laisse deux montants en dollars tranquilles", () => {
    // Sans ce garde-fou, « 30$ puis 40$ » ferait de « puis » une formule.
    const texte = "payer 30$ puis 40$ ensuite";
    expect(segmenterFormulesEnLigne(texte)).toEqual([{ formule: false, texte }]);
  });

  it("rend un seul segment de prose quand il n'y a aucune formule", () => {
    expect(segmenterFormulesEnLigne("texte simple")).toEqual([
      { formule: false, texte: "texte simple" },
    ]);
  });
});
