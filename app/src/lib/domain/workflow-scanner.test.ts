import { describe, expect, it } from "vitest";
import { scannerWorkflow } from "./workflow-scanner";
import { parcourirWorkflow, statistiquesGraphe } from "./workflow-graphe";

describe("scannerWorkflow", () => {
  it("construit un graphe non vide avec la page Atelier et ses surfaces", async () => {
    const graphe = await scannerWorkflow();
    const resultat = parcourirWorkflow(graphe, "page:/");
    const stats = statistiquesGraphe(resultat, graphe);

    expect(stats.totalNoeuds).toBeGreaterThan(0);
    expect(stats.atteignables).toBeGreaterThan(0);

    // L'Atelier est la destination primaire du rail (navigation.ts) : le
    // scanner doit la produire et la relier à ses surfaces réelles — la
    // génération d'exercice, la révision de domaine et l'exercice autonome.
    const liensAtelier = graphe.liens.filter((l) => l.source === "page:/atelier");
    const targetsAtelier = liensAtelier.map((l) => l.target);

    expect(targetsAtelier).toContain("modal:generer-un-exercice");
    expect(targetsAtelier).toContain("modal:reviser-domaine");
    expect(targetsAtelier).toContain("page:/exercices/{id}");
  });
});