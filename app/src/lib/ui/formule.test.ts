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

  it("pose une barre au-dessus du groupe — overline et bar", () => {
    expect(latexVersTexte("\\overline{x}")).toBe("x\u0304");
    expect(latexVersTexte("\\bar{z}")).toBe("z\u0304");
  });

  it("porte vecteur, chapeau et tilde sur le symbole", () => {
    expect(latexVersTexte("\\vec{F} = m \\cdot \\vec{a}")).toBe("F\u20D7 = m · a\u20D7");
    expect(latexVersTexte("\\hat{x}")).toBe("x\u0302");
    expect(latexVersTexte("\\tilde{x}")).toBe("x\u0303");
  });

  it("développe un coefficient binomial en C(n, k)", () => {
    expect(latexVersTexte("\\binom{n}{k}")).toBe("C(n, k)");
  });

    it("rend les ensembles usuels — \\mathbb{R} → ℝ", () => {
    expect(latexVersTexte("x \\in \\mathbb{R}")).toBe("x ∈ ℝ");
    expect(latexVersTexte("n \\in \\mathbb{N}")).toBe("n ∈ ℕ");
  });
  it("convertit mid et vert en barre verticale", () => {
    expect(latexVersTexte("P(A \\mid B)")).toBe("P(A | B)");
    expect(latexVersTexte("\\{x \\mid x > 2\\}")).toBe("{x | x > 2}");
  });

  it("préserve les accolades d'ensemble sans barre oblique résiduelle", () => {
    expect(latexVersTexte("\\left\\{ x \\right\\}")).toBe("{ x }");
  });

  it("transforme une matrice en texte lisible — sans `begin` ni `&`", () => {
    expect(latexVersTexte("\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}")).toBe(
      "( a b ; c d )",
    );
  });

  it("transforme un environnement cases en texte lisible", () => {
    expect(
      latexVersTexte("\\begin{cases} x & \\text{si } a \\\\ y & \\text{sinon} \\end{cases}"),
    ).toBe("{ x si a ; y sinon }");
  });

  it("une ouverture d'environnement jamais fermée reste lisible — flux écourté", () => {
    expect(latexVersTexte("\\begin{pmatrix} a & b")).toBe("( a b )");
  });

  it("ne rend jamais vide une formule qu'il ne couvre pas", () => {
    const inconnue = "\\totalement{inconnue}";
    const rendu = latexVersTexte(inconnue);
    expect(rendu).not.toBe("");
    expect(rendu).toContain("inconnue");
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
