import { describe, expect, it } from "vitest";
import { scannerWorkflow } from "./workflow-scanner";
import { parcourirWorkflow } from "./workflow-graphe";

describe("scannerWorkflow", () => {
  it("construit un graphe complet incluant toutes les modales et liens de l'Atelier", async () => {
    const graphe = await scannerWorkflow();
    expect(graphe.noeuds.length).toBeGreaterThan(0);
    expect(graphe.liens.length).toBeGreaterThan(0);

    const pageAtelier = graphe.noeuds.find((n) => n.id === "page:/atelier");
    expect(pageAtelier).toBeDefined();

    const liensAtelier = graphe.liens.filter((l) => l.source === "page:/atelier");
    const targetsAtelier = liensAtelier.map((l) => l.target);

    // Vérifie que les modales autrefois coupées sont désormais découvertes
    expect(targetsAtelier).toContain("modal:generer-un-exercice");
    expect(targetsAtelier).toContain("page:/exercices/{id}");

    const resultat = parcourirWorkflow(graphe, "page:/");
    expect(resultat.noeuds.some((n) => n.id === "page:/atelier")).toBe(true);
    expect(resultat.inatteignables).toEqual([]);
  });
});
