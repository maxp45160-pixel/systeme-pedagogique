import { describe, expect, it } from "vitest";
import { scannerUxJourney } from "./workflow-ux-scanner";
import { parcourirWorkflow, statistiquesGraphe } from "./workflow-graphe";

describe("scannerUxJourney", () => {
  it("construit dynamiquement le graphe Macro-UX de synthèse", async () => {
    const graphe = await scannerUxJourney({ mode: "macro" });
    const resultat = parcourirWorkflow(graphe, "page:/");
    const stats = statistiquesGraphe(resultat, graphe);

    expect(stats.totalNoeuds).toBeGreaterThan(25);
    expect(stats.atteignables).toBe(stats.totalNoeuds);
    expect(resultat.inatteignables).toHaveLength(0);

    const idsNoeuds = new Set(graphe.noeuds.map((n) => n.id));
    expect(idsNoeuds).toContain("page:/");
    expect(idsNoeuds).toContain("page:/atelier");
    expect(idsNoeuds).toContain("page:/seances");
    expect(idsNoeuds).toContain("page:/exercices/{id}");
    expect(idsNoeuds).toContain("ux:concepteur-seance");
    expect(idsNoeuds).toContain("modal:theme-ia");
  });

  it("construit dynamiquement le graphe Atomique avec exhaustivité totale et Atelier complet", async () => {
    const graphe = await scannerUxJourney({ mode: "atomique" });
    const resultat = parcourirWorkflow(graphe, "page:/");
    const stats = statistiquesGraphe(resultat, graphe);

    expect(stats.totalNoeuds).toBeGreaterThan(50);
    expect(stats.atteignables).toBe(stats.totalNoeuds);
    expect(resultat.inatteignables).toHaveLength(0);

    const idsNoeuds = new Set(graphe.noeuds.map((n) => n.id));

    // Sous-onglets de compétence & actions
    expect(idsNoeuds).toContain("ux:fiche-competence-synthese");
    expect(idsNoeuds).toContain("ux:fiche-competence-progression");
    expect(idsNoeuds).toContain("ux:fiche-competence-relations");
    expect(idsNoeuds).toContain("ux:fiche-competence-notes");
    expect(idsNoeuds).toContain("action:archiver-competence");

    // Sous-onglets de domaine & projections
    expect(idsNoeuds).toContain("ux:fiche-domaine-structure");
    expect(idsNoeuds).toContain("ux:fiche-domaine-radar");
    expect(idsNoeuds).toContain("ux:fiche-domaine-gestion");
    expect(idsNoeuds).toContain("modal:ajouter-des-competences");
    expect(idsNoeuds).toContain("ux:projection-theme");
    expect(idsNoeuds).toContain("ux:projection-exercice");
    expect(idsNoeuds).toContain("action:supprimer-theme");

    // Gestion documentaire atomique
    expect(idsNoeuds).toContain("action:televerser-pdf");
    expect(idsNoeuds).toContain("action:supprimer-pdf");
    expect(idsNoeuds).toContain("action:figer-revision");
    expect(idsNoeuds).toContain("ux:apercu-snapshot");
    expect(idsNoeuds).toContain("action:ajouter-wikilien");
    expect(idsNoeuds).toContain("ux:categorie-dossier");
    expect(idsNoeuds).toContain("modal:nouveau-document");

    // Live séance & Pomodoro
    expect(idsNoeuds).toContain("ux:pomodoro");
    expect(idsNoeuds).toContain("action:ajouter-note");
    expect(idsNoeuds).toContain("action:enregistrer-jalon");
    expect(idsNoeuds).toContain("action:abandonner-activite-adaptative");
    expect(idsNoeuds).toContain("ux:seance-bilan");

    // Réglages & Profil atomique
    expect(idsNoeuds).toContain("ux:profil-objectifs");
    expect(idsNoeuds).toContain("action:modifier-profil");
    expect(idsNoeuds).toContain("action:configurer-cle-ia");
    expect(idsNoeuds).toContain("action:reinitialiser-compte");

    // Feedback & Recommandation
    expect(idsNoeuds).toContain("ux:feedback-recommandation");
  });

  it("génère et exporte les graphes DOT audités sans nœuds isolés", async () => {
    const { exporterDOT } = await import("./workflow-export");
    const grapheAtomique = await scannerUxJourney({ mode: "atomique" });
    const resultat = parcourirWorkflow(grapheAtomique, "page:/");
    const stats = statistiquesGraphe(resultat, grapheAtomique);

    expect(stats.atteignables).toBe(stats.totalNoeuds);
    expect(stats.inatteignables).toBe(0);
    const dot = exporterDOT(grapheAtomique.noeuds, grapheAtomique.liens, { avecConditions: true });
    expect(dot).toContain("digraph workflow");
    expect(dot).toContain("cluster_atelier");

    console.log(`[Validation UX Journey] ${stats.totalNoeuds} nœuds, ${stats.totalLiens} liens, 0 inatteignables.`);
  });
});
