import { describe, expect, it } from "vitest";
import { decouperEnBlocs } from "./markdown-blocs";

/**
 * Le premier test de ce fichier est le seul qui compte vraiment.
 *
 * Avant correction, `decouperEnBlocs("| Étape | Formule |")` ne rendait jamais
 * la main : le navigateur gelait et l'onglet mourait, emportant la conversation
 * en cours. Un test qui « échoue » par non-terminaison ne dit rien de lisible —
 * d'où le `timeout` explicite : la non-terminaison devient un échec nommé.
 */
describe("decouperEnBlocs — terminaison", () => {
  it(
    "consomme une ligne « | » orpheline au lieu de boucler",
    () => {
      const blocs = decouperEnBlocs("Voici le tableau :\n| Étape | Formule |");
      expect(blocs).toEqual([
        { genre: "paragraphe", texte: "Voici le tableau :" },
        { genre: "paragraphe", texte: "| Étape | Formule |" },
      ]);
    },
    2000,
  );

  it(
    "traverse un tableau en cours de flux (en-tête reçue avant le séparateur)",
    () => {
      // C'est l'état par lequel passe TOUT tableau rédigé par le tuteur, au
      // premier flush du flux SSE.
      const enCours = "| Grandeur | Valeur |";
      expect(decouperEnBlocs(enCours)).toHaveLength(1);

      // Le séparateur arrive : le même texte devient un tableau.
      const complet = "| Grandeur | Valeur |\n|---|---|\n| Débit | 12 |";
      expect(decouperEnBlocs(complet)).toEqual([
        {
          genre: "tableau",
          entetes: ["Grandeur", "Valeur"],
          corps: [["Débit", "12"]],
        },
      ]);
    },
    2000,
  );

  it(
    "termine sur une valeur absolue en début de ligne",
    () => {
      const blocs = decouperEnBlocs("|x| < 3 donc la solution tient.");
      expect(blocs).toEqual([{ genre: "paragraphe", texte: "|x| < 3 donc la solution tient." }]);
    },
    2000,
  );
});

describe("decouperEnBlocs — blocs reconnus", () => {
  it("rend un bloc de code avec sa langue", () => {
    const blocs = decouperEnBlocs("```python\nprint(1)\n```");
    expect(blocs).toEqual([{ genre: "code", langue: "python", corps: "print(1)" }]);
  });

  it("rend titres, citations et listes", () => {
    const blocs = decouperEnBlocs(
      "## Titre\n\n> une citation\n\n- premier\n- second\n\n1. un\n2. deux",
    );
    expect(blocs).toEqual([
      { genre: "titre", texte: "Titre" },
      { genre: "citation", texte: "une citation" },
      { genre: "liste", ordonnee: false, items: ["premier", "second"] },
      { genre: "liste", ordonnee: true, items: ["un", "deux"] },
    ]);
  });

  it("agrège les lignes contiguës en un paragraphe", () => {
    expect(decouperEnBlocs("une ligne\net sa suite\n\nautre")).toEqual([
      { genre: "paragraphe", texte: "une ligne et sa suite" },
      { genre: "paragraphe", texte: "autre" },
    ]);
  });

  it("rend les blocs formules \\[ ... \\], $$ ... $$ et \\begin{...}", () => {
    const markdown =
      "Texte avant\n\n\\[\n\\frac{a+b}{2}\n\\]\n\n$$\nx^2 + y^2 = 1\n$$\n\n\\begin{pmatrix}\n1 & 2 \\\\\n3 & 4\n\\end{pmatrix}\n\nTexte après";
    const blocs = decouperEnBlocs(markdown);
    expect(blocs).toEqual([
      { genre: "paragraphe", texte: "Texte avant" },
      { genre: "formule", latex: "\\frac{a+b}{2}" },
      { genre: "formule", latex: "x^2 + y^2 = 1" },
      { genre: "formule", latex: "\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}" },
      { genre: "paragraphe", texte: "Texte après" },
    ]);
  });

  it("reconnaît une équation matricielle comme bloc formule", () => {
    const markdown = "A = \\begin{pmatrix} 3 & 1 \\ 2 & 4 \\ \\end{pmatrix}";
    const blocs = decouperEnBlocs(markdown);
    expect(blocs).toEqual([
      { genre: "formule", latex: "A = \\begin{pmatrix} 3 & 1 \\ 2 & 4 \\ \\end{pmatrix}" },
    ]);
  });

  it("ne rend rien pour un texte vide", () => {
    expect(decouperEnBlocs("")).toEqual([]);
    expect(decouperEnBlocs("\n\n")).toEqual([]);
  });
});
