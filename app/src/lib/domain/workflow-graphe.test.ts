import { describe, expect, it } from "vitest";
import {
  parcourirWorkflow,
  statistiquesGraphe,
  type GrapheWorkflow,
} from "./workflow-graphe";

/*
 * Ce que ce fichier protège :
 *
 *  1. Le BFS découvre tous les nœuds atteignables depuis la racine, dans
 *     l'ordre de la largeur d'abord.
 *  2. Les nœuds déclarés mais inatteignables sont signalés — un état mort
 *     est un défaut de déclaration, pas un silence.
 *  3. Toute arête pointe vers un nœud déclaré — une arête cassée est un
 *     défaut de déclaration.
 *  4. Les statistiques (degrés, puits, sources, diamètre) sont correctes.
 *
 * Le graphe lui-même est produit par `workflow-scanner.ts` ; ces tests
 * vérifient la logique de parcours et de statistiques sur des graphes
 * synthétiques.
 */

describe("parcourirWorkflow", () => {
  it("découvre la racine en premier, puis ses voisins directs", () => {
    const graphe: GrapheWorkflow = {
      noeuds: [
        { id: "a", type: "page", libelle: "A" },
        { id: "b", type: "page", libelle: "B" },
        { id: "c", type: "page", libelle: "C" },
      ],
      liens: [
        { source: "a", target: "b", type: "navigation", libelle: "A→B" },
        { source: "a", target: "c", type: "navigation", libelle: "A→C" },
      ],
    };
    const resultat = parcourirWorkflow(graphe, "a");
    expect(resultat.ordre[0]).toBe("a");
    expect(resultat.profondeurs.get("a")).toBe(0);

    // Les voisins directs de la racine sont à profondeur 1.
    const voisins = graphe.liens
      .filter((l) => l.source === "a")
      .map((l) => l.target);
    for (const v of voisins) {
      expect(resultat.profondeurs.get(v)).toBe(1);
    }
  });

  it("signale les nœuds déclarés mais inatteignables depuis la racine", () => {
    const graphe: GrapheWorkflow = {
      noeuds: [
        { id: "a", type: "page", libelle: "A" },
        { id: "orpheline", type: "page", libelle: "Orpheline" },
      ],
      liens: [],
    };
    const resultat = parcourirWorkflow(graphe, "a");
    expect(resultat.inatteignables.map((n) => n.id)).toEqual(["orpheline"]);
  });

  it("lève une erreur si la racine est inconnue", () => {
    const graphe: GrapheWorkflow = {
      noeuds: [{ id: "a", type: "page", libelle: "A" }],
      liens: [],
    };
    expect(() => parcourirWorkflow(graphe, "page:/inexistante")).toThrow(
      "Nœud racine inconnu",
    );
  });

  it("lève une erreur si une arête pointe vers un nœud non déclaré", () => {
    const graphe: GrapheWorkflow = {
      noeuds: [{ id: "a", type: "page", libelle: "A" }],
      liens: [
        { source: "a", target: "b", type: "navigation", libelle: "Vers B" },
      ],
    };
    expect(() => parcourirWorkflow(graphe, "a")).toThrow("nœud cible non déclaré");
  });

  it("ne visite chaque nœud qu'une seule fois, même avec plusieurs chemins", () => {
    const graphe: GrapheWorkflow = {
      noeuds: [
        { id: "a", type: "page", libelle: "A" },
        { id: "b", type: "page", libelle: "B" },
        { id: "c", type: "page", libelle: "C" },
      ],
      liens: [
        { source: "a", target: "b", type: "navigation", libelle: "A→B" },
        { source: "a", target: "c", type: "navigation", libelle: "A→C" },
        { source: "b", target: "c", type: "navigation", libelle: "B→C" },
      ],
    };
    const resultat = parcourirWorkflow(graphe, "a");
    expect(resultat.ordre).toEqual(["a", "b", "c"]);
    expect(resultat.noeuds).toHaveLength(3);
    /*
     * 1 et non 2 : un BFS retient la distance la PLUS COURTE, et `a → c` est
     * direct. L'attente de 2 lisait le chemin le plus long (`a → b → c`), ce
     * qu'un BFS ne mesure jamais — c'est précisément la propriété qui rend
     * `diametreBFS` interprétable.
     */
    expect(resultat.profondeurs.get("c")).toBe(1);
  });

  it("la profondeur est la distance la plus courte, pas le chemin le plus long", () => {
    const graphe: GrapheWorkflow = {
      noeuds: [
        { id: "a", type: "page", libelle: "A" },
        { id: "b", type: "page", libelle: "B" },
        { id: "c", type: "page", libelle: "C" },
      ],
      liens: [
        { source: "a", target: "b", type: "navigation", libelle: "A→B" },
        { source: "b", target: "c", type: "navigation", libelle: "B→C" },
      ],
    };
    // Sans raccourci `a → c`, la seule distance possible est 2.
    expect(parcourirWorkflow(graphe, "a").profondeurs.get("c")).toBe(2);
  });
});

describe("statistiquesGraphe", () => {
  it("calcule les degrés, puits, sources et le diamètre BFS", () => {
    const graphe: GrapheWorkflow = {
      noeuds: [
        { id: "a", type: "page", libelle: "A" },
        { id: "b", type: "page", libelle: "B" },
        { id: "c", type: "page", libelle: "C" },
        { id: "d", type: "page", libelle: "D" },
      ],
      liens: [
        { source: "a", target: "b", type: "navigation", libelle: "A→B" },
        { source: "a", target: "c", type: "navigation", libelle: "A→C" },
        { source: "b", target: "d", type: "navigation", libelle: "B→D" },
        { source: "c", target: "d", type: "navigation", libelle: "C→D" },
      ],
    };
    const resultat = parcourirWorkflow(graphe, "a");
    const stats = statistiquesGraphe(resultat, graphe);

    expect(stats.totalNoeuds).toBe(4);
    expect(stats.totalLiens).toBe(4);
    expect(stats.atteignables).toBe(4);
    expect(stats.inatteignables).toBe(0);
    expect(stats.degreSortantMoyen).toBe(1); // 4 arêtes / 4 nœuds
    expect(stats.degreEntrantMoyen).toBe(1);
    expect(stats.puits).toEqual(["d"]);
    expect(stats.sources).toEqual(["a"]);
    expect(stats.diametreBFS).toBe(2);
  });

  it("identifie les nœuds inatteignables dans les statistiques", () => {
    const graphe: GrapheWorkflow = {
      noeuds: [
        { id: "a", type: "page", libelle: "A" },
        { id: "b", type: "page", libelle: "B" },
      ],
      liens: [{ source: "a", target: "b", type: "navigation", libelle: "A→B" }],
    };
    const resultat = parcourirWorkflow(graphe, "a");
    const stats = statistiquesGraphe(resultat, graphe);
    expect(stats.atteignables).toBe(2);
    expect(stats.inatteignables).toBe(0);
  });

  it("un graphe à plusieurs niveaux a un diamètre BFS strictement positif", () => {
    const graphe: GrapheWorkflow = {
      noeuds: [
        { id: "a", type: "page", libelle: "A" },
        { id: "b", type: "page", libelle: "B" },
        { id: "c", type: "page", libelle: "C" },
        { id: "d", type: "page", libelle: "D" },
      ],
      liens: [
        { source: "a", target: "b", type: "navigation", libelle: "A→B" },
        { source: "b", target: "c", type: "navigation", libelle: "B→C" },
        { source: "c", target: "d", type: "navigation", libelle: "C→D" },
      ],
    };
    const resultat = parcourirWorkflow(graphe, "a");
    const stats = statistiquesGraphe(resultat, graphe);
    expect(stats.diametreBFS).toBe(3);
    expect(stats.atteignables).toBe(4);
    expect(stats.totalLiens).toBe(3);
  });

  it("exclut les nœuds heuristiques du compteur de puits", () => {
    const graphe: GrapheWorkflow = {
      noeuds: [
        { id: "a", type: "page", libelle: "A" },
        { id: "b", type: "page", libelle: "B" },
        { id: "m", type: "sous-vue", libelle: "Zoom canvas", heuristique: true },
      ],
      liens: [
        { source: "a", target: "b", type: "navigation", libelle: "A→B" },
        { source: "a", target: "m", type: "interaction", libelle: "Zoom" },
      ],
    };
    const resultat = parcourirWorkflow(graphe, "a");
    const stats = statistiquesGraphe(resultat, graphe);

    // `b` et `m` sont tous deux des feuilles, mais `m` est une affordance
    // heuristique : elle ne compte pas comme fin de parcours.
    expect(stats.puits).toEqual(["b"]);
  });
});
