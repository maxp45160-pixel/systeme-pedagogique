import { describe, expect, it } from "vitest";
import { scannerWorkflow } from "./workflow-scanner";
import { parcourirWorkflow, statistiquesGraphe } from "@/lib/domain/workflow-graphe";

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

      // Modale imbriquée : le parcours projet, monté par la capture
      // d'intention (elle-même du cadre), est atteignable depuis la racine.
      const atteignables = new Set(resultat.noeuds.map((n) => n.id));
      expect(atteignables).toContain("modal:nouveau-projet");
    },
    25000,
  );

  it(
    "modélise la navigation persistante du cadre (rail + barre mobile)",
    async () => {
      const graphe = await scannerWorkflow();
      const resultat = parcourirWorkflow(graphe, "page:/");
      const atteignables = new Set(resultat.noeuds.map((n) => n.id));

      // Le rail rend ces destinations sur TOUTES les pages du groupe `(app)` :
      // elles ne peuvent plus sembler inaccessibles.
      expect(atteignables).toContain("page:/aide");
      expect(atteignables).toContain("page:/compte");
      expect(atteignables).toContain("page:/progression");
      expect(atteignables).toContain("page:/atelier");

      // Le hub du cadre porte la navigation persistante : chaque écran du
      // groupe `(app)` rejoint le rail, et le rail dessert ses destinations.
      const versRail = graphe.liens.filter((l) => l.target === "cadre:rail");
      expect(versRail.map((l) => l.source)).toContain("page:/seances");
      expect(versRail.every((l) => l.cadre === true)).toBe(true);
      const duRail = graphe.liens
        .filter((l) => l.source === "cadre:rail")
        .map((l) => l.target);
      expect(duRail).toContain("page:/aide");
      expect(duRail).toContain("page:/compte");

      // `/compte` devient joignable depuis la racine en passant par le rail.
      expect(atteignables).toContain("page:/compte");
      expect(resultat.profondeurs.get("page:/compte")).toBeLessThanOrEqual(2);
    },
    25000,
  );
});
