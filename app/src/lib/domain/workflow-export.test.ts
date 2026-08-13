import { describe, expect, it } from "vitest";
import { parcourirWorkflow, type GrapheWorkflow } from "./workflow-graphe";
import {
  exporterDOT,
  exporterJSON,
  exporterWorkflowComplet,
  listeAdjacence,
  matriceAdjacence,
} from "./workflow-export";

/*
 * Ce que ce fichier protège : les exports produisent des objets mathématiques
 * corrects — matrice d'adjacence binaire, listes d'adjacence dédupliquées,
 * DOT syntaxiquement valide, JSON complet et sérialisable.
 */

const GRAPHE_TEST: GrapheWorkflow = {
  noeuds: [
    { id: "page:/", type: "page", libelle: "Tableau de bord", url: "/" },
    { id: "page:/seances", type: "page", libelle: "Cahier", url: "/seances" },
    { id: "modal:test", type: "modal", libelle: "Modale test" },
  ],
  liens: [
    {
      source: "page:/",
      target: "page:/seances",
      type: "navigation",
      libelle: "Cahier (rail)",
    },
    {
      source: "page:/",
      target: "modal:test",
      type: "ouverture",
      libelle: "Ouvrir",
    },
  ],
};

describe("matriceAdjacence", () => {
  it("produit une matrice binaire carrée avec 1 aux positions des arêtes", () => {
    const noeuds = [
      { id: "a", type: "page" as const, libelle: "A" },
      { id: "b", type: "page" as const, libelle: "B" },
      { id: "c", type: "page" as const, libelle: "C" },
    ];
    const liens = [
      { source: "a", target: "b", type: "navigation" as const, libelle: "A→B" },
      { source: "a", target: "c", type: "navigation" as const, libelle: "A→C" },
      { source: "b", target: "c", type: "navigation" as const, libelle: "B→C" },
    ];
    const { noeuds: ids, matrice, nombreAretes } = matriceAdjacence(noeuds, liens);

    expect(ids).toEqual(["a", "b", "c"]);
    expect(matrice).toEqual([
      [0, 1, 1],
      [0, 0, 1],
      [0, 0, 0],
    ]);
    expect(nombreAretes).toBe(3);
  });

  it("déduplique les arêtes multiples entre les mêmes nœuds", () => {
    const noeuds = [
      { id: "a", type: "page" as const, libelle: "A" },
      { id: "b", type: "page" as const, libelle: "B" },
    ];
    const liens = [
      { source: "a", target: "b", type: "navigation" as const, libelle: "A→B (1)" },
      { source: "a", target: "b", type: "navigation" as const, libelle: "A→B (2)" },
    ];
    const { matrice, nombreAretes } = matriceAdjacence(noeuds, liens);
    expect(matrice[0][1]).toBe(1);
    expect(nombreAretes).toBe(1);
  });

  it("ignore les arêtes vers des nœuds hors de la liste", () => {
    const noeuds = [{ id: "a", type: "page" as const, libelle: "A" }];
    const liens = [
      { source: "a", target: "b", type: "navigation" as const, libelle: "A→B" },
    ];
    const { matrice, nombreAretes } = matriceAdjacence(noeuds, liens);
    expect(matrice).toEqual([[0]]);
    expect(nombreAretes).toBe(0);
  });
});

describe("listeAdjacence", () => {
  it("construit les successeurs et prédécesseurs dédupliqués", () => {
    const liens = [
      { source: "a", target: "b", type: "navigation" as const, libelle: "A→B" },
      { source: "a", target: "b", type: "navigation" as const, libelle: "A→B (2)" },
      { source: "b", target: "c", type: "navigation" as const, libelle: "B→C" },
    ];
    const { successeurs, predecesseurs } = listeAdjacence(liens);

    expect(successeurs.a).toEqual(["b"]);
    expect(successeurs.b).toEqual(["c"]);
    expect(predecesseurs.b).toEqual(["a"]);
    expect(predecesseurs.c).toEqual(["b"]);
  });
});

describe("exporterDOT", () => {
  it("produit un digraphe avec les nœuds et arêtes", () => {
    const noeuds = [
      { id: "page:/", type: "page" as const, libelle: "Tableau de bord", url: "/" },
      { id: "modal:test", type: "modal" as const, libelle: "Modale test" },
    ];
    const liens = [
      {
        source: "page:/",
        target: "modal:test",
        type: "ouverture" as const,
        libelle: "Ouvrir",
      },
    ];
    const dot = exporterDOT(noeuds, liens, { avecConditions: true });

    expect(dot).toContain("digraph workflow {");
    expect(dot).toContain('"page:/"');
    expect(dot).toContain('"modal:test"');
    expect(dot).toContain('"page:/" -> "modal:test"');
    expect(dot).toContain("shape=box");
    expect(dot).toContain("shape=ellipse");
    expect(dot).toContain("label=\"Tableau de bord\"");
  });

  it("échappe les caractères réservés dans les identifiants", () => {
    const noeuds = [
      { id: "page:/competences/{code}", type: "page" as const, libelle: "Fiche" },
    ];
    const dot = exporterDOT(noeuds, [], { avecLibelles: false });
    expect(dot).toContain('"page:/competences/{code}"');
  });

  it("marque les arêtes conditionnelles en pointillés", () => {
    const noeuds = [
      { id: "a", type: "page" as const, libelle: "A" },
      { id: "b", type: "page" as const, libelle: "B" },
    ];
    const liens = [
      {
        source: "a",
        target: "b",
        type: "navigation" as const,
        libelle: "A→B",
        condition: "référentiel vide",
      },
    ];
    const dot = exporterDOT(noeuds, liens, { avecConditions: true });
    expect(dot).toContain("style=dashed");
    expect(dot).toContain("tooltip=\"référentiel vide\"");
  });
});

describe("exporterJSON", () => {
  it("sérialise le graphe complet avec statistiques", () => {
    const resultat = parcourirWorkflow(GRAPHE_TEST, "page:/");
    const json = exporterJSON(resultat, GRAPHE_TEST, "page:/");

    expect(json.format).toBe("workflow-graphe");
    expect(json.version).toBe(1);
    expect(json.racine).toBe("page:/");
    expect(json.noeuds.length).toBe(resultat.noeuds.length);
    expect(json.liens.length).toBe(resultat.liens.length);
    expect(json.inatteignables.length).toBe(resultat.inatteignables.length);
    expect(json.profondeurs["page:/"]).toBe(0);
    expect(json.statistiques.atteignables).toBe(resultat.noeuds.length);
    expect(json.statistiques.totalNoeuds).toBe(GRAPHE_TEST.noeuds.length);
  });

  it("est sérialisable en JSON sans perte", () => {
    const resultat = parcourirWorkflow(GRAPHE_TEST, "page:/");
    const json = exporterJSON(resultat, GRAPHE_TEST, "page:/");
    const relu = JSON.parse(JSON.stringify(json)) as typeof json;
    expect(relu.noeuds).toHaveLength(json.noeuds.length);
    expect(relu.liens).toHaveLength(json.liens.length);
  });
});

describe("exporterWorkflowComplet", () => {
  it("produit tous les formats d'un coup", () => {
    const resultat = parcourirWorkflow(GRAPHE_TEST, "page:/");
    const complet = exporterWorkflowComplet(resultat, GRAPHE_TEST, "page:/");

    expect(complet.json.format).toBe("workflow-graphe");
    expect(complet.dot).toContain("digraph workflow {");
    expect(complet.matrice.noeuds.length).toBe(resultat.noeuds.length);
    expect(complet.matrice.matrice.length).toBe(resultat.noeuds.length);
    expect(complet.liste.successeurs).toBeDefined();
    expect(complet.liste.predecesseurs).toBeDefined();
  });

  it("la matrice est carrée et binaire", () => {
    const resultat = parcourirWorkflow(GRAPHE_TEST, "page:/");
    const complet = exporterWorkflowComplet(resultat, GRAPHE_TEST, "page:/");
    const n = complet.matrice.noeuds.length;
    expect(complet.matrice.matrice).toHaveLength(n);
    for (const ligne of complet.matrice.matrice) {
      expect(ligne).toHaveLength(n);
      for (const valeur of ligne) {
        expect(valeur === 0 || valeur === 1).toBe(true);
      }
    }
  });
});