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

      // Une page du groupe porte des arêtes de navigation persistante explicites.
      const liensPersistants = graphe.liens.filter(
        (l) => l.source === "page:/seances" && l.libelle === "Navigation persistante",
      );
      expect(liensPersistants.map((l) => l.target)).toContain("page:/aide");
      expect(liensPersistants.map((l) => l.target)).toContain("page:/compte");

      // `/compte` devient joignable depuis la racine sans passer par un profil.
      expect(atteignables).toContain("page:/compte");
      expect(resultat.profondeurs.get("page:/compte")).toBeLessThanOrEqual(1);
    },
    25000,
  );
});
