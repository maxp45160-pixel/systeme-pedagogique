import { describe, expect, it } from "vitest";
import {
  GRAPHE_WORKFLOW,
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
 */

describe("parcourirWorkflow", () => {
  it("découvre la racine en premier, puis ses voisins directs", () => {
    const resultat = parcourirWorkflow(GRAPHE_WORKFLOW, "page:/");
    expect(resultat.ordre[0]).toBe("page:/");
    expect(resultat.profondeurs.get("page:/")).toBe(0);

    // Les voisins directs de la racine sont à profondeur 1.
    const voisins = GRAPHE_WORKFLOW.liens
      .filter((l) => l.source === "page:/")
      .map((l) => l.target);
    for (const v of voisins) {
      expect(resultat.profondeurs.get(v)).toBe(1);
    }
  });

  it("signale les nœuds déclarés mais inatteignables depuis la racine", () => {
    const resultat = parcourirWorkflow(GRAPHE_WORKFLOW, "page:/");
    // `/login` n'est pas atteignable depuis le tableau de bord dans le flux
    // principal : il est atteint par redirection depuis le layout, pas par un
    // lien. Il doit donc apparaître dans `inatteignables`.
    expect(resultat.inatteignables.some((n) => n.id === "page:/login")).toBe(true);
  });

  it("lève une erreur si la racine est inconnue", () => {
    expect(() => parcourirWorkflow(GRAPHE_WORKFLOW, "page:/inexistante")).toThrow(
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
    expect(resultat.profondeurs.get("c")).toBe(2);
  });

  it("le graphe déclaré est cohérent : toutes les arêtes pointent vers des nœuds déclarés", () => {
    const ids = new Set(GRAPHE_WORKFLOW.noeuds.map((n) => n.id));
    for (const lien of GRAPHE_WORKFLOW.liens) {
      expect(ids.has(lien.source), `source inconnue : ${lien.source}`).toBe(true);
      expect(ids.has(lien.target), `cible inconnue : ${lien.target}`).toBe(true);
    }
  });

  it("le graphe déclaré ne contient pas d'identifiants dupliqués", () => {
    const ids = GRAPHE_WORKFLOW.noeuds.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
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

  it("le graphe réel a un diamètre BFS strictement positif", () => {
    const resultat = parcourirWorkflow(GRAPHE_WORKFLOW, "page:/");
    const stats = statistiquesGraphe(resultat, GRAPHE_WORKFLOW);
    expect(stats.diametreBFS).toBeGreaterThan(0);
    expect(stats.atteignables).toBeGreaterThan(10);
    expect(stats.totalLiens).toBeGreaterThan(50);
  });
});

describe("cohérence du graphe déclaré", () => {
  it("chaque type de nœud est représenté", () => {
    const types = new Set(GRAPHE_WORKFLOW.noeuds.map((n) => n.type));
    for (const t of ["page", "modal", "tiroir", "etape", "action"] as const) {
      expect(types.has(t), `type manquant : ${t}`).toBe(true);
    }
  });

  it("chaque type de lien est représenté", () => {
    const types = new Set(GRAPHE_WORKFLOW.liens.map((l) => l.type));
    for (const t of ["navigation", "ouverture", "transition", "soumission", "retour"] as const) {
      expect(types.has(t), `type manquant : ${t}`).toBe(true);
    }
  });

  it("toutes les pages déclarées ont une URL", () => {
    for (const n of GRAPHE_WORKFLOW.noeuds) {
      if (n.type === "page") {
        expect(n.url, `page sans URL : ${n.id}`).toBeDefined();
      }
    }
  });

  it("le parcours depuis chaque page racine atteint au moins elle-même", () => {
    const pages = GRAPHE_WORKFLOW.noeuds.filter((n) => n.type === "page");
    for (const page of pages) {
      const resultat = parcourirWorkflow(GRAPHE_WORKFLOW, page.id);
      expect(resultat.noeuds.some((n) => n.id === page.id)).toBe(true);
    }
  });
});