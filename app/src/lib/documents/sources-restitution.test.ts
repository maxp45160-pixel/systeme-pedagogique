import { describe, expect, it } from "vitest";
import { sourcesRestitution, traduireSourcesRestitution } from "./sources-restitution";
import { validerElementsDepot } from "./depot-validation";

const phrase = "La base en vidéos : cours et exercices";
const formule = String.raw`- Simplifier: pour \( b \) et \( c \) non nuls, \( \frac{a \times c}{b \times c} = \frac{a}{b} \)`;
const pages = [
  { pieceId: "ats", page: 1, texte: "Présentation du livret", incertain: false },
  { pieceId: "ats", page: 2, texte: `Fiche n°1\r\n# Fractions\r\n${formule}\r\n${phrase}`, incertain: false },
  { pieceId: "ats", page: 12, texte: phrase, incertain: true },
  { pieceId: "autre", page: 1, texte: phrase, incertain: false },
];
const element = (source: unknown) => ({ elements: [{ nature: "sujet", texte: "Calcul", sources: [source] }] });

describe("passages de restitution", () => {
  it("extrait la formule ATS exactement, sans demander de recopie au modèle", () => {
    const catalogue = sourcesRestitution("", pages);
    const passage = catalogue.sources[1].passages.find((p) => p.texte === formule)!;
    const brut = traduireSourcesRestitution(element({ passageId: passage.passageId }), "", pages);
    expect(validerElementsDepot(brut, "doc", "", pages, "test")[0].sources).toEqual([{ documentId: "doc", pieceId: "ats", page: 2, citation: formule }]);
  });
  it("distingue la note et les occurrences identiques de pages ou fichiers différents", () => {
    const catalogue = sourcesRestitution(phrase, pages);
    expect(catalogue.sources.every((s) => !("page" in s) && !("pieceId" in s))).toBe(true);
    expect(catalogue.sources[3].incertain).toBe(true);
    const passages = catalogue.sources.flatMap((s) => s.passages);
    expect(new Set(passages.map((p) => p.passageId)).size).toBe(passages.length);
    const references = passages.filter((p) => p.texte === phrase).map((p) =>
      traduireSourcesRestitution(element({ passageId: p.passageId }), phrase, pages).elements[0].sources[0]);
    expect(references).toEqual([
      { pieceId: null, page: null, citation: phrase },
      { pieceId: "ats", page: 2, citation: phrase },
      { pieceId: "ats", page: 12, citation: phrase },
      { pieceId: "autre", page: 1, citation: phrase },
    ]);
  });
  it("découpe les longues lignes sans altération ni perte de contenu, y compris Unicode", () => {
    const lignes = ["x".repeat(1999) + "𝛼" + "y".repeat(2500), "mot ".repeat(1200) + "fin", formule, "| Formule | Valeur |"];
    const texte = lignes.join("\r\n\r\n");
    const catalogue = sourcesRestitution(texte, []);
    const passages = catalogue.sources[0].passages;
    expect(passages.map((p) => p.texte).join("")).toBe(lignes.join(""));
    for (const p of passages) {
      expect(p.texte.trim()).not.toBe("");expect(p.texte.length).toBeLessThanOrEqual(2000);
      expect(texte).toContain(p.texte);expect(p.texte.isWellFormed()).toBe(true);
    }
    expect(sourcesRestitution(texte, [])).toEqual(catalogue);
  });
  it("ne propose aucun passage pour une note ou page blanche", () => {
    const catalogue = sourcesRestitution(" \r\n\t", [{ ...pages[0], texte: "\r\n \t", incertain: true }]);
    expect(catalogue.sources).toEqual([{ nature: "page", passages: [], incertain: true }]);
    expect(catalogue.references.size).toBe(0);
  });
  it("refuse les pages d'entrée dupliquées", () => {
    expect(() => sourcesRestitution("", [pages[0], pages[0]])).toThrow("Page extraite invalide");
  });
  it.each([
    {}, { passageId: "invente" }, { passageId: "passage-0", citation: formule },
    { passageId: "passage-0", page: 2 }, { passageId: "passage-0", pieceId: "ats" },
    { passageId: "passage-0", documentId: "doc" }, { passageId: "passage-0", sourceId: "src-0" },
    { sourceId: "src-1", citation: "Simplifier: pour b et c non nuls, (a×c)/(b×c) = a/b" },
  ])("refuse identifiant absent/inconnu et toute citation ou ancien repère : %j", (source) => {
    expect(() => traduireSourcesRestitution(element(source), "", pages)).toThrow();
  });
  it.each([undefined, null, { mode: "existant", id: "maths" }, { mode: "nouveau", nom: "Mathématiques" }])("traduit toutes les sources V2 en conservant les propositions : %j", (domaine) => {
    const sources = [{ passageId: "passage-3" }];
    const brut = { elements: [], organisation: {
      titreSuggere: "Livret", sources, domaine: domaine && { ...domaine, sources },
      competences: [{ mode: "existante", code: "M-01", sources }, { mode: "nouvelle", objet: "équation", sources }],
    } };
    const resultat = traduireSourcesRestitution(brut, "", pages);
    const canonique = [{ pieceId: "ats", page: 2, citation: formule }];
    expect(resultat).toEqual({ elements: [], organisation: {
      titreSuggere: "Livret", sources: canonique, domaine: domaine ? { ...domaine, sources: canonique } : null,
      competences: [{ mode: "existante", code: "M-01", sources: canonique }, { mode: "nouvelle", objet: "équation", sources: canonique }],
    } });
    expect(brut.organisation.sources).toEqual(sources);
  });
});
