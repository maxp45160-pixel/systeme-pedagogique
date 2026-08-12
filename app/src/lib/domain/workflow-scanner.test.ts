import { describe, expect, it } from "vitest";
import { scannerWorkflow } from "./workflow-scanner";
import { parcourirWorkflow, statistiquesGraphe } from "./workflow-graphe";

describe("scannerWorkflow", () => {
  it("construit un graphe complet avec 100% de nœuds atteignables et toutes les modales de l'Atelier", async () => {
    const graphe = await scannerWorkflow();
    const resultat = parcourirWorkflow(graphe, "page:/");
    const stats = statistiquesGraphe(resultat, graphe);

    expect(stats.totalNoeuds).toBeGreaterThan(0);
    expect(stats.inatteignables).toBe(0);
    expect(stats.atteignables).toBe(stats.totalNoeuds);

    const liensAtelier = graphe.liens.filter((l) => l.source === "page:/atelier");
    const targetsAtelier = liensAtelier.map((l) => l.target);

    expect(targetsAtelier).toContain("modal:generer-un-exercice");
    expect(targetsAtelier).toContain("modal:reviser-domaine");
    expect(targetsAtelier).toContain("page:/exercices/{id}");
  });
});
