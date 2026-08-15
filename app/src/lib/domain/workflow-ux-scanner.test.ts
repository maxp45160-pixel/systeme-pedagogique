import { describe, expect, it } from "vitest";
import { scannerUxJourney } from "./workflow-ux-scanner";
import { parcourirWorkflow, statistiquesGraphe } from "./workflow-graphe";

describe("scannerUxJourney", () => {
  it("construit dynamiquement un graphe de parcours UX connecté avec tous les sous-systèmes réels", async () => {
    const graphe = await scannerUxJourney();
    const resultat = parcourirWorkflow(graphe, "page:/");
    const stats = statistiquesGraphe(resultat, graphe);

    expect(stats.totalNoeuds).toBeGreaterThan(25);
    expect(stats.atteignables).toBe(stats.totalNoeuds);
    expect(resultat.inatteignables).toHaveLength(0);

    // Vérifier la présence de tous les groupes UX
    const groupesPresents = new Set(graphe.noeuds.map((n) => n.groupe));
    expect(groupesPresents).toContain("dashboard");
    expect(groupesPresents).toContain("atelier");
    expect(groupesPresents).toContain("seances");
    expect(groupesPresents).toContain("exercice");
    expect(groupesPresents).toContain("tuteur");
    expect(groupesPresents).toContain("profil");

    // Vérifier les sous-états interactifs exhaustifs de l'Atelier
    const idsNoeuds = new Set(graphe.noeuds.map((n) => n.id));
    expect(idsNoeuds).toContain("ux:explorateur-sidebar");
    expect(idsNoeuds).toContain("ux:atelier-graphe");
    expect(idsNoeuds).toContain("ux:galerie-domaines");
    expect(idsNoeuds).toContain("ux:vue-transversale");
    expect(idsNoeuds).toContain("ux:categorie-dossier");
    expect(idsNoeuds).toContain("ux:fiche-competence");
    expect(idsNoeuds).toContain("ux:fiche-domaine");
    expect(idsNoeuds).toContain("ux:editeur-note");
    expect(idsNoeuds).toContain("ux:apercu-snapshot");
    expect(idsNoeuds).toContain("ux:panneau-contexte");

    // Actions documentaires
    expect(idsNoeuds).toContain("action:creer-note");
    expect(idsNoeuds).toContain("action:figer-revision");
    expect(idsNoeuds).toContain("action:televerser-pdf");
    expect(idsNoeuds).toContain("action:supprimer-pdf");
    expect(idsNoeuds).toContain("action:supprimer-note");
    expect(idsNoeuds).toContain("action:ajouter-wikilien");

    // Vérifier la boucle d'exercice en 3 actes
    expect(idsNoeuds).toContain("ux:exercice-chercher");
    expect(idsNoeuds).toContain("ux:exercice-indices");
    expect(idsNoeuds).toContain("ux:exercice-abandon");
    expect(idsNoeuds).toContain("ux:exercice-comparer");
    expect(idsNoeuds).toContain("ux:exercice-mesurer");
    expect(idsNoeuds).toContain("ux:exercice-bilan-final");

    // Vérifier les déclencheurs (triggers)
    const liensAvecDeclencheur = graphe.liens.filter((l) => Boolean(l.declencheur));
    expect(liensAvecDeclencheur.length).toBeGreaterThan(25);

    // Vérifier les transitions de l'explorateur et du canvas
    const liensExplorateur = graphe.liens.filter((l) => l.source === "ux:explorateur-sidebar");
    expect(liensExplorateur.map((l) => l.target)).toContain("ux:galerie-domaines");
    expect(liensExplorateur.map((l) => l.target)).toContain("ux:vue-transversale");

    const liensCanvas = graphe.liens.filter((l) => l.source === "ux:atelier-graphe");
    expect(liensCanvas.map((l) => l.target)).toContain("ux:fiche-competence");
    expect(liensCanvas.map((l) => l.target)).toContain("ux:fiche-domaine");

    // Vérifier le volet contexte et snapshots
    const liensContexte = graphe.liens.filter((l) => l.source === "ux:panneau-contexte");
    expect(liensContexte.map((l) => l.target)).toContain("ux:apercu-snapshot");
    expect(liensContexte.map((l) => l.target)).toContain("action:televerser-pdf");
    expect(liensContexte.map((l) => l.target)).toContain("action:ajouter-wikilien");
  });

  it("génère et exporte le graphe DOT audité", async () => {
    const { exporterDOT } = await import("./workflow-export");
    const graphe = await scannerUxJourney();
    const resultat = parcourirWorkflow(graphe, "page:/");
    const stats = statistiquesGraphe(resultat, graphe);
    console.log("GRAPH_STATS:", JSON.stringify({
      totalNoeuds: stats.totalNoeuds,
      totalLiens: stats.totalLiens,
      atteignables: stats.atteignables,
      inatteignables: stats.inatteignables,
      diametreBFS: stats.diametreBFS,
      degreSortantMoyen: Number(stats.degreSortantMoyen.toFixed(2)),
      degreEntrantMoyen: Number(stats.degreEntrantMoyen.toFixed(2)),
      noeudsParType: graphe.noeuds.reduce((acc, n) => { acc[n.type] = (acc[n.type] || 0) + 1; return acc; }, {} as Record<string, number>),
      noeudsParGroupe: graphe.noeuds.reduce((acc, n) => { acc[n.groupe || "aucun"] = (acc[n.groupe || "aucun"] || 0) + 1; return acc; }, {} as Record<string, number>),
      puits: stats.puits,
      sources: stats.sources,
    }, null, 2));
    const dot = exporterDOT(graphe.noeuds, graphe.liens, { avecConditions: true });
    expect(dot).toContain("digraph workflow");
  });
});
