import { describe, expect, it } from "vitest";

import { construireArbreDossiers, compterElements, trouverNoeudDossier } from "./arbre-atelier";
import { cheminsDepuisDefinition, resoudreCheminsDocumentAtelier } from "./chemins-atelier";
import { definitionTypeDocument } from "./types-documents";
import { FORMATS_PAR_ROLE } from "./roles-note";

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

  /*
   * Le rôle prime sur le dossier par défaut du type. Sans cela, une séance
   * partirait sous « Séances » et une expérimentation sous
   * « Productions/Expérimentations » : les notes opérationnelles seraient
   * éparpillées alors qu'elles forment une seule catégorie.
   */
  it("range toute note opérationnelle sous la même racine, quel que soit son format", () => {
    for (const { valeur } of FORMATS_PAR_ROLE.operationnel) {
      const definition = definitionTypeDocument(valeur);
      const chemins = cheminsDepuisDefinition(definition, { role: "operationnel" });
      const branche = definition?.libelle.endsWith("s") ? definition.libelle : `${definition?.libelle}s`;
      expect(chemins.dossier, `format « ${valeur} »`).toBe(`Transversal/${branche}`);
      expect(chemins.dossiersSecondaires, `format « ${valeur} »`).toEqual([]);
    }
  });

  /*
   * `projet` porte `dossierParDefaut: "Preuves/Projets"`. Une note qui la
   * déclare opérationnelle ne doit pas suivre ce repli : elle n'est pas une
   * preuve tant qu'aucune évaluation ne l'a validée.
   */
  it("ne range jamais une note opérationnelle parmi les preuves", () => {
    const chemins = cheminsDepuisDefinition(definitionTypeDocument("projet"), {
      role: "operationnel",
    });
    for (const chemin of [chemins.dossier, ...chemins.dossiersSecondaires]) {
      expect(chemin.startsWith("Transversal/Preuves")).toBe(false);
    }
  });

  it("range une note de support sous sa propre racine", () => {
    expect(cheminsDepuisDefinition(definitionTypeDocument("cours"), { role: "support" })).toEqual({
      dossier: "Transversal/Notes de support/Cours",
      dossiersSecondaires: [],
    });
  });

  it("ne range plus un projet parmi les preuves, même sans rôle déclaré", () => {
    const chemins = cheminsDepuisDefinition(definitionTypeDocument("projet"), {});
    expect(chemins.dossier).toBe("Projets");
    for (const chemin of [chemins.dossier, ...chemins.dossiersSecondaires]) {
      expect(chemin.startsWith("Transversal/Preuves")).toBe(false);
    }
  });

  it("retrouve tous les sous-nœuds intermédiaires pour la résolution du fil d'Ariane", () => {
    const arbre = construireArbreDossiers([
      { id: "note-1", titre: "Ma Note", type: "note", dossier: "Transversal/Notes de support/Note personnelle" },
      { id: "prev-1", titre: "Preuve 1", type: "preuve", dossier: "Transversal/Preuves" },
      { id: "exo-1", titre: "Exercice 1", type: "exercice", dossier: "Domaines/Algèbre/Exercices" },
    ]);

    expect(trouverNoeudDossier(arbre, "Transversal")).not.toBeNull();
    expect(trouverNoeudDossier(arbre, "Transversal/Notes de support")).not.toBeNull();
    expect(trouverNoeudDossier(arbre, "Transversal/Notes de support/Note personnelle")).not.toBeNull();
    expect(trouverNoeudDossier(arbre, "Transversal/Preuves")).not.toBeNull();
    expect(trouverNoeudDossier(arbre, "Domaines/Algèbre")).not.toBeNull();
    expect(trouverNoeudDossier(arbre, "Domaines/Algèbre/Exercices")).not.toBeNull();
  });
});

