import { describe, expect, it } from "vitest";
import { scannerWorkflow } from "./workflow-scanner";
import { parcourirWorkflow, statistiquesGraphe } from "./workflow-graphe";

describe("scannerWorkflow", () => {
  it(
    "construit un graphe non vide avec les pages réelles et leurs liaisons",
    async () => {
      const graphe = await scannerWorkflow();
      const resultat = parcourirWorkflow(graphe, "page:/");
      const stats = statistiquesGraphe(resultat, graphe);

      expect(stats.totalNoeuds).toBeGreaterThan(10);
      expect(stats.atteignables).toBeGreaterThan(0);

      const idsNoeuds = graphe.noeuds.map((n) => n.id);
      expect(idsNoeuds).toContain("page:/");
      expect(idsNoeuds).toContain("page:/atelier");
      expect(idsNoeuds).toContain("page:/seances");
      expect(idsNoeuds).toContain("page:/exercices/{id}");
      expect(idsNoeuds).toContain("page:/atelier?document");

      // Vérifier la présence d'actions serveur réelles
      const typesNoeuds = new Set(graphe.noeuds.map((n) => n.type));
      expect(typesNoeuds).toContain("page");
      expect(typesNoeuds).toContain("action");

      // L'Atelier est relié aux documents et à ses navigations
      expect(graphe.liens).toContainEqual(
        expect.objectContaining({
          target: "page:/atelier?document",
        }),
      );
    },
    25000,
  );
});
