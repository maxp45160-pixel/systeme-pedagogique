import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { rangementPreuve, rangementRessource } from "@/lib/documents/rangement-atelier";
import type { ElementAtelier } from "./types-atelier";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import { VueRessources } from "./vues-ressources-atelier";
import { ResultatsRecherche } from "./espace-documentaire";

function ressource(id: string, options: Partial<ElementAtelier> = {}): ElementAtelier {
  return {
    id, titre: `Document ${id}`, type: "cours", typeLibelle: "Cours", categorie: "connaissance",
    rangement: rangementRessource([]), contenuMd: "", contenuCharge: true,
    frontMatter: { role: "support" }, liens: [], sortants: [], entrants: [], snapshots: [],
    tentatives: [], source: "document", lectureSeule: false, ...options,
  };
}

const nomsDomaines = { organisation: "Organisation documentaire", algebre: "Algèbre" };
const domaineDeCompetence = { "B-1": "algebre" };
const fixtures = [
  ressource("explicite", { domaineId: "organisation", rangement: rangementRessource(["B-1"]) }),
  ressource("vide", { domaineId: "organisation" }),
  ressource("inconnu-un", { domaineId: "inconnu-1", rangement: rangementRessource(["B-1"]) }),
  ressource("inconnu-deux", { domaineId: "inconnu-2" }),
  ressource("sans-domaine"),
  ressource("preuve", { type: "tentative", frontMatter: {}, rangement: rangementPreuve(), source: "projection", lectureSeule: true }),
];
function renduRessources(elements: ElementAtelier[], statut: "actifs" | "archives" = "actifs") {
  return renderToStaticMarkup(createElement(VueRessources, {
    elements, statut, ouvrirElement: vi.fn(), changerVue: vi.fn(), competencesParCode: new Map(),
    nomsDomaines, domaineDeCompetence,
  }));
}
function renduRecherche(elements: ElementAtelier[]) {
  return renderToStaticMarkup(createElement(ResultatsRecherche, {
    elements, terme: "Document", couleursDomaines: {}, nomsDomaines, domaineDeCompetence, ouvrir: vi.fn(),
  }));
}
function occurrences(html: string, titre: string) { return html.split(`>${titre}<`).length - 1; }

describe("documents retrouvables après classement", () => {
  it("Ressources affiche chaque ressource une fois même avec plusieurs domaines inconnus", () => {
    const avant = structuredClone(fixtures);
    const html = renduRessources(fixtures);
    for (const element of fixtures.filter((element) => element.rangement.zone === "ressource")) {
      expect(occurrences(html, element.titre), element.id).toBe(1);
    }
    expect(html).toContain("Organisation documentaire");
    expect(html).not.toContain(">Algèbre<");
    expect(html).toContain("Autres ressources");
    expect(html).not.toContain("Document preuve");
    expect(fixtures).toEqual(avant);
  });

  it("la recherche conserve les inconnus, le non-classé et les projections hors corpus", () => {
    const html = renduRecherche(fixtures);
    for (const element of fixtures) expect(occurrences(html, element.titre), element.id).toBe(1);
    expect(html).toContain("Organisation documentaire");
    expect(html).not.toContain(">Algèbre<");
    expect(html).toContain("Autres résultats");
    expect(html).toContain("Lecture seule");
  });

  it.each([renduRessources, renduRecherche])("suit une correction puis un retrait avec repli historique", (rendu) => {
    const element = fixtures[0];
    expect(rendu([element])).toContain("Organisation documentaire");
    const corrige = { ...element, domaineId: "algebre" };
    expect(rendu([corrige])).toContain(">Algèbre<");
    expect(rendu([corrige])).not.toContain("Organisation documentaire");
    expect(rendu([{ ...element, domaineId: undefined }])).toContain(">Algèbre<");
    const retire = { ...element, domaineId: undefined, rangement: rangementRessource([]) };
    expect(occurrences(rendu([retire]), element.titre)).toBe(1);
    expect(rendu([retire])).not.toContain("Organisation documentaire");
  });

  it.each([renduRessources, renduRecherche])("conserve les résultats même sans aucun groupe nommé", (rendu) => {
    const inconnus = fixtures.slice(2, 5);
    const html = rendu(inconnus);
    for (const element of inconnus) expect(occurrences(html, element.titre)).toBe(1);
  });

  it("préserve le filtre archives et le tri alphabétique des ressources", () => {
    const archives = [ressource("archive", { frontMatter: { archive: true } }), ...fixtures];
    const actifs = renduRessources(archives);
    expect(actifs).not.toContain("Document archive");
    expect(actifs.indexOf("Document inconnu-deux")).toBeLessThan(actifs.indexOf("Document inconnu-un"));
    const html = renduRessources(archives, "archives");
    expect(occurrences(html, "Document archive")).toBe(1);
    expect(html).not.toContain("Document explicite");
  });

  it("propose une correction accessible aux seules ressources V2, sans confondre l'ouverture du document", () => {
    const html = renduRessources([
      ressource("depot avec espace", { frontMatter: { role: "support", depot_version: 2 } }),
      ressource("ancien", { frontMatter: { role: "support", depot_version: 1 } }),
      ressource("ordinaire"),
      ressource("projection", { frontMatter: { depot_version: 2 }, source: "projection" }),
    ]);
    expect(html).toContain('href="/app?depot=depot%20avec%20espace"');
    expect(html).toContain('aria-label="Corriger le rangement de Document depot avec espace"');
    expect(html.match(/>Corriger le rangement<\/a>/g)).toHaveLength(1);
    expect(html).not.toContain('href="/app?depot=ancien"');
    expect(html).not.toContain('href="/app?depot=ordinaire"');
    expect(html).not.toContain('href="/app?depot=projection"');
  });

  it.each([renduRessources, renduRecherche])("ne fusionne pas des titres identiques entre groupes nommés et inconnus", (rendu) => {
    const elements = ["organisation", "algebre", "inconnu-1", "inconnu-2"].map((domaineId, index) =>
      ressource(`homonyme-${index}`, { titre: "Titre partagé", domaineId, typeLibelle: `Repère ${index}` }));
    const avant = structuredClone(elements);
    const html = rendu(elements);
    expect(occurrences(html, "Titre partagé")).toBe(4);
    for (let index = 0; index < elements.length; index++) expect(occurrences(html, `Repère ${index}`)).toBe(1);
    expect(elements).toEqual(avant);
  });

  it("la recherche conserve les rôles hors corpus dans leur ordre, même avec un domaine connu", () => {
    const elements = [
      ressource("z-operationnel", { type: "note", domaineId: "organisation", frontMatter: { role: "operationnel" } }),
      ressource("support", { type: "note", domaineId: "organisation" }),
      ressource("a-projection", { type: "exercice", domaineId: "organisation", frontMatter: {}, source: "projection", lectureSeule: true }),
      ressource("cours", { domaineId: "organisation", frontMatter: {} }),
    ];
    const html = renduRecherche(elements);
    const debutAutres = html.indexOf("Autres résultats");
    expect(debutAutres).toBeGreaterThan(-1);
    for (const element of elements) expect(occurrences(html, element.titre)).toBe(1);
    expect(html.indexOf("Document support")).toBeLessThan(debutAutres);
    expect(html.indexOf("Document cours")).toBeLessThan(debutAutres);
    expect(html.indexOf("Document z-operationnel")).toBeGreaterThan(debutAutres);
    expect(html.indexOf("Document a-projection")).toBeGreaterThan(html.indexOf("Document z-operationnel"));
  });
});
