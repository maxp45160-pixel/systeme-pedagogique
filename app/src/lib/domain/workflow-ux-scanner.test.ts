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

    // Boucle d'exercice — deux actes réels (Chercher → Mesurer), plus les
    // variantes qui les portent (ADR-079, vue-exercice.tsx)
    expect(idsNoeuds).toContain("ux:exercice-chercher");
    expect(idsNoeuds).toContain("ux:exercice-mesurer");
    expect(idsNoeuds).not.toContain("ux:exercice-comparer");
    expect(idsNoeuds).not.toContain("ux:exercice-bilan-final");
    expect(idsNoeuds).toContain("page:/seances?evaluer");
    expect(idsNoeuds).toContain("page:/seances?bilan");
    expect(idsNoeuds).toContain("page:/seances?abandon");

    // Cadre partagé : le rail dessert /compte et /aide depuis toutes les pages
    // du groupe, et le tiroir tuteur / le point d'entrée `+` y sont ouverts.
    const entrantsParId = new Map<string, number>();
    for (const l of graphe.liens) {
      entrantsParId.set(l.target, (entrantsParId.get(l.target) ?? 0) + 1);
    }
    expect(entrantsParId.get("page:/compte") ?? 0).toBeGreaterThan(1);
    expect(entrantsParId.get("page:/aide") ?? 0).toBeGreaterThan(1);
    expect(entrantsParId.get("tiroir:tuteur") ?? 0).toBeGreaterThan(1);
    expect(entrantsParId.get("modal:de-quoi-as-tu-besoin") ?? 0).toBeGreaterThan(1);

    // Qualification des arêtes de cadre (cadre: true)
    const liensCadre = graphe.liens.filter((l) => l.cadre === true);
    expect(liensCadre.length).toBeGreaterThan(20);
    expect(liensCadre.every((l) => l.cadre)).toBe(true);

    // Graphe filtré sans cadre : réduction du volume d'arêtes sans détruire le flux
    const liensSansCadre = graphe.liens.filter((l) => !l.cadre);
    expect(liensSansCadre.length).toBeLessThan(graphe.liens.length);

    // Micro-interactions réelles détectées (Canvas, Pomodoro, Tuteur, Accordéons)
    const microNoeuds = graphe.noeuds.filter((n) => n.id.startsWith("micro:"));
    expect(microNoeuds.length).toBeGreaterThan(5);
    // Les micros heuristiques les plus bruités ont été retirés.
    const idsMicro = new Set(microNoeuds.map((n) => n.id));
    expect([...idsMicro].some((id) => id.includes("aide-memoire"))).toBe(false);
    expect([...idsMicro].some((id) => id.includes("clavier-echap"))).toBe(false);

    // Les actions de clôture d'exercice ne sont plus des puits : elles
    // redirigent vers /seances (redirection dynamique résolue).
    const sortants = new Map<string, number>();
    for (const l of graphe.liens) sortants.set(l.source, (sortants.get(l.source) ?? 0) + 1);
    expect(sortants.get("action:terminerexercice") ?? 0).toBeGreaterThan(0);
    expect(sortants.get("action:abandonnerexercice") ?? 0).toBeGreaterThan(0);

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
    expect(ids).toContain("modal:de-quoi-as-tu-besoin");
    expect(ids).toContain("page:/seances");
    expect(ids).toContain("ux:exercice-bilan-final");
    expect(ids).toContain("page:/atelier");
    expect(ids).toContain("page:/progression");
    expect(ids).toContain("page:/compte");
    expect(ids).toContain("tiroir:tuteur");

    // Vérifier les transitions directrices de valeur
    const clefsLiens = new Set(graphe.liens.map((l) => `${l.source}→${l.target}`));
    expect(clefsLiens).toContain("page:/→modal:de-quoi-as-tu-besoin");
    expect(clefsLiens).toContain("page:/seances→ux:exercice-bilan-final");
    expect(clefsLiens).toContain("ux:exercice-bilan-final→page:/");
  }, 20000);
});
