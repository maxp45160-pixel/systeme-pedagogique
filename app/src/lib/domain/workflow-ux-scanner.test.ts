import { describe, expect, it } from "vitest";
import { scannerUxJourney } from "./workflow-ux-scanner";
import { parcourirWorkflow, statistiquesGraphe } from "./workflow-graphe";

describe("scannerUxJourney (dynamique AST)", () => {
  it("construit dynamiquement le graphe complet du parcours UX sans aucun registre codé en dur", async () => {
    const graphe = await scannerUxJourney();
    const resultat = parcourirWorkflow(graphe, "page:/");
    const stats = statistiquesGraphe(resultat, graphe);

    expect(stats.totalNoeuds).toBeGreaterThan(50);
    expect(stats.atteignables).toBe(stats.totalNoeuds);
    expect(resultat.inatteignables).toHaveLength(0);

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
    expect(idsNoeuds).toContain("page:/exercices/{id}");
    expect(idsNoeuds).toContain("page:/demarrer");
    expect(idsNoeuds).toContain("page:/login");

    // Surfaces de l'Atelier
    expect(idsNoeuds).toContain("ux:espacedocumentaire");

    // Boucle d'exercice
    expect(idsNoeuds).toContain("ux:exercice-chercher");
    expect(idsNoeuds).toContain("ux:exercice-comparer");
    expect(idsNoeuds).toContain("ux:exercice-mesurer");
    expect(idsNoeuds).toContain("ux:exercice-bilan-final");

    // Déclencheurs atomiques
    const liensAvecDeclencheur = graphe.liens.filter((l) => Boolean(l.declencheur));
    expect(liensAvecDeclencheur.length).toBeGreaterThan(50);
  }, 20000);
});
