import { describe, expect, it } from "vitest";
import { scannerUxJourney } from "./workflow-ux-scanner";
import { parcourirWorkflow, statistiquesGraphe } from "./workflow-graphe";

describe("scannerUxJourney (dynamique AST)", () => {
  it("construit dynamiquement le graphe atomique ultra-détaillé sans aucun registre codé en dur", async () => {
    const graphe = await scannerUxJourney({ mode: "atomique" });
    const resultat = parcourirWorkflow(graphe, "page:/");
    const stats = statistiquesGraphe(resultat, graphe);

    expect(stats.totalNoeuds).toBeGreaterThanOrEqual(100);
    expect(stats.totalNoeuds).toBeLessThanOrEqual(300);
    expect(stats.atteignables).toBe(stats.totalNoeuds);
    expect(resultat.inatteignables).toHaveLength(0);

    // ZÉRO faux-positif sur les dossiers non-UI (lib/)
    const fauxPositifsLib = graphe.noeuds.filter((n) => n.id.startsWith("micro:lib-"));
    expect(fauxPositifsLib).toHaveLength(0);

    // Vérifier la présence des groupes clés
    const groupesPresents = new Set(graphe.noeuds.map((n) => n.groupe));
    expect(groupesPresents).toContain("dashboard");
    expect(groupesPresents).toContain("atelier");
    expect(groupesPresents).toContain("seances");
    expect(groupesPresents).toContain("exercice");
    expect(groupesPresents).toContain("profil");

    // Vérifier la présence de types de nœuds variés (pages, sous-vues, modales, actions, étapes)
    const typesPresents = new Set(graphe.noeuds.map((n) => n.type));
    expect(typesPresents).toContain("page");
    expect(typesPresents).toContain("sous-vue");
    expect(typesPresents).toContain("modal");
    expect(typesPresents).toContain("action");
    expect(typesPresents).toContain("etape");

    // Vérifier que des surfaces interactives réelles sont extraites
    const idsNoeuds = new Set(graphe.noeuds.map((n) => n.id));
    expect(idsNoeuds).toContain("page:/");
    expect(idsNoeuds).toContain("page:/atelier");
    expect(idsNoeuds).toContain("page:/seances");
    expect(idsNoeuds).toContain("page:/demarrer");
    expect(idsNoeuds).toContain("page:/login");

    // Surfaces de l'Atelier
    expect(idsNoeuds).toContain("ux:espacedocumentaire");

    // Boucle d'exercice
    expect(idsNoeuds).toContain("ux:exercice-chercher");
    expect(idsNoeuds).toContain("ux:exercice-comparer");
    expect(idsNoeuds).toContain("ux:exercice-mesurer");
    expect(idsNoeuds).toContain("ux:exercice-bilan-final");

    // Micro-interactions réelles détectées (Canvas, Pomodoro, Tuteur, Accordéons)
    const microNoeuds = graphe.noeuds.filter((n) => n.id.startsWith("micro:"));
    expect(microNoeuds.length).toBeGreaterThan(5);

    // Déclencheurs atomiques
    const liensAvecDeclencheur = graphe.liens.filter((l) => Boolean(l.declencheur));
    expect(liensAvecDeclencheur.length).toBeGreaterThan(50);
  }, 20000);

  it("construit une vue de synthèse (Macro) épurée et articulée sur le funnel de valeur pédagogique", async () => {
    const graphe = await scannerUxJourney({ mode: "macro" });
    const resultat = parcourirWorkflow(graphe, "page:/");
    const stats = statistiquesGraphe(resultat, graphe);

    // La vue macro doit être compacte (8 à 14 macro-pôles)
    expect(stats.totalNoeuds).toBeGreaterThanOrEqual(8);
    expect(stats.totalNoeuds).toBeLessThanOrEqual(14);
    expect(stats.atteignables).toBe(stats.totalNoeuds);
    expect(resultat.inatteignables).toHaveLength(0);

    const ids = new Set(graphe.noeuds.map((n) => n.id));
    expect(ids).toContain("page:/");
    expect(ids).toContain("modal:nouvelle-donnee");
    expect(ids).toContain("page:/seances");
    expect(ids).toContain("ux:exercice-bilan-final");
    expect(ids).toContain("page:/atelier");
    expect(ids).toContain("page:/progression");
    expect(ids).toContain("page:/compte");
    expect(ids).toContain("tiroir:tuteur");

    // Vérifier les transitions directrices de valeur
    const clefsLiens = new Set(graphe.liens.map((l) => `${l.source}→${l.target}`));
    expect(clefsLiens).toContain("page:/→modal:nouvelle-donnee");
    expect(clefsLiens).toContain("page:/seances→ux:exercice-bilan-final");
    expect(clefsLiens).toContain("ux:exercice-bilan-final→page:/");
  }, 20000);
});
