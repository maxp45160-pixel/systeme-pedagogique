import { describe, expect, it } from "vitest";

import { construireArbreDossiers, compterElements, trouverNoeudDossier } from "./arbre-atelier";
import { resoudreCheminsDocumentAtelier } from "./chemins-atelier";

describe("navigation de l'Atelier", () => {
  it("donne aux preuves un seul chemin canonique transversal", () => {
    expect(resoudreCheminsDocumentAtelier({ categorie: "preuve", dossierParDefaut: "Preuves", frontMatter: {} })).toEqual({
      dossier: "Transversal/Preuves",
      dossiersSecondaires: [],
    });
    expect(resoudreCheminsDocumentAtelier({ categorie: "action", dossierParDefaut: "Preuves/Projets", frontMatter: {} })).toEqual({
      dossier: "Transversal/Preuves/Projets",
      dossiersSecondaires: [],
    });
  });

  it("dérive les catégories transversales non vides sans doubler les identifiants", () => {
    const arbre = construireArbreDossiers([
      { id: "P-1", titre: "Projet", type: "preuve", dossier: "Transversal/Preuves" },
      { id: "C-1", titre: "Compétence", type: "competence", dossier: "Domaines/D/Compétences", dossiersSecondaires: ["Transversal/Compétences"] },
    ]);
    const transversal = trouverNoeudDossier(arbre, "Transversal");
    expect(transversal?.enfants.map(({ nom }) => nom)).toEqual(["Compétences", "Preuves"]);
    expect(compterElements(transversal!)).toBe(2);
    expect(arbre.some(({ nom }) => nom === "Preuves")).toBe(false);
  });
});
