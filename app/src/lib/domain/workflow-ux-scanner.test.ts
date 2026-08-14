import { describe, expect, it } from "vitest";
import { scannerUxJourney } from "./workflow-ux-scanner";
import { parcourirWorkflow, statistiquesGraphe } from "./workflow-graphe";

describe("scannerUxJourney", () => {
  it("construit un graphe de parcours UX connecté avec les 6 sous-systèmes et leurs triggers", async () => {
    const graphe = await scannerUxJourney();
    const resultat = parcourirWorkflow(graphe, "page:/");
    const stats = statistiquesGraphe(resultat, graphe);

    expect(stats.totalNoeuds).toBeGreaterThan(20);
    expect(stats.atteignables).toBe(stats.totalNoeuds);
    expect(resultat.inatteignables).toHaveLength(0);

    // Vérifier la présence des groupes UX
    const groupesPresents = new Set(graphe.noeuds.map((n) => n.groupe));
    expect(groupesPresents).toContain("dashboard");
    expect(groupesPresents).toContain("atelier");
    expect(groupesPresents).toContain("seances");
    expect(groupesPresents).toContain("exercice");
    expect(groupesPresents).toContain("tuteur");
    expect(groupesPresents).toContain("profil");

    // Vérifier les sous-états interactifs de l'Atelier
    const idsNoeuds = new Set(graphe.noeuds.map((n) => n.id));
    expect(idsNoeuds).toContain("ux:atelier-graphe");
    expect(idsNoeuds).toContain("ux:fiche-competence");
    expect(idsNoeuds).toContain("ux:fiche-domaine");
    expect(idsNoeuds).toContain("ux:editeur-note");

    // Vérifier la boucle d'exercice en 3 actes
    expect(idsNoeuds).toContain("ux:exercice-chercher");
    expect(idsNoeuds).toContain("ux:exercice-comparer");
    expect(idsNoeuds).toContain("ux:exercice-mesurer");
    expect(idsNoeuds).toContain("ux:exercice-bilan-final");

    // Vérifier que les déclencheurs (triggers) sont bien renseignés
    const liensAvecDeclencheur = graphe.liens.filter((l) => Boolean(l.declencheur));
    expect(liensAvecDeclencheur.length).toBeGreaterThan(15);

    // Vérifier les transitions spécifiques de l'Atelier Canvas
    const liensCanvas = graphe.liens.filter((l) => l.source === "ux:atelier-graphe");
    expect(liensCanvas.map((l) => l.target)).toContain("ux:fiche-competence");
    expect(liensCanvas.map((l) => l.target)).toContain("ux:fiche-domaine");

    // Vérifier la boucle de rebond après bilan d'exercice
    const liensBilan = graphe.liens.filter((l) => l.source === "ux:exercice-bilan-final");
    const targetsBilan = liensBilan.map((l) => l.target);
    expect(targetsBilan).toContain("page:/atelier");
    expect(targetsBilan).toContain("page:/");
    expect(targetsBilan).toContain("ux:exercice-chercher");
  });
});
