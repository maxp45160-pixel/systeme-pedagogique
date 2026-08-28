import { describe, expect, it } from "vitest";
import type { VueDomaineAtelier } from "./vue-atelier";
import {
  calculerRatioCouverture,
  filtrerEtTrierDomaines,
} from "./tri-domaines";

function creerDomaineFactice(partiel: Partial<VueDomaineAtelier> & { id: string; nom: string }): VueDomaineAtelier {
  return {
    kind: "domaine",
    id: partiel.id,
    nom: partiel.nom,
    description: partiel.description ?? "",
    competences: partiel.competences ?? [
      { code: `${partiel.id}-01`, titre: "Comp 1", palier: "fondamentaux", niveau: null, score: null, confiance: "nulle", nombreObservations: 0, importance: 0.5, prerequis: [], suivantes: [] },
      { code: `${partiel.id}-02`, titre: "Comp 2", palier: "fondamentaux", niveau: null, score: null, confiance: "nulle", nombreObservations: 0, importance: 0.5, prerequis: [], suivantes: [] },
    ],
    domaine: {
      id: partiel.id,
      nom: partiel.nom,
      prefixe: partiel.id.toUpperCase().slice(0, 3),
      description: partiel.description ?? "",
      ordre: partiel.domaine?.ordre ?? 0,
      version: 1,
      archive: false,
      origine: "utilisateur",
    },
    skills: [],
    retraits: {},
    domainesExistants: [],
    changements: [],
    nombreEvaluees: partiel.nombreEvaluees ?? 0,
    nombreObservations: partiel.nombreObservations ?? 0,
    nombreExercices: partiel.nombreExercices ?? 0,
    derniereActivite: partiel.derniereActivite ?? null,
    arbre: partiel.arbre ?? { domaineId: partiel.id, rangees: [], aretes: [], feuilles: [] },
    parentId: partiel.parentId ?? null,
    parentNom: partiel.parentNom ?? null,
    chemin: partiel.chemin ?? [{ id: partiel.id, nom: partiel.nom }],
    enfants: partiel.enfants ?? [],
    parentsPossibles: partiel.parentsPossibles ?? [],
    rattachementCarte: partiel.rattachementCarte ?? null,
    classificationCarte: partiel.classificationCarte ?? null,
    ressources: partiel.ressources ?? [],
    orchestrationModule: partiel.orchestrationModule ?? { thisWeek: [], deadlines: [] },
  };
}

describe("tri-domaines", () => {
  const d1 = creerDomaineFactice({
    id: "stoicisme",
    nom: "Fondements du stoïcisme",
    description: "Principes philosophiques",
    nombreEvaluees: 0,
    derniereActivite: null,
    domaine: { id: "stoicisme", nom: "Fondements du stoïcisme", prefixe: "STO", description: "", ordre: 1, version: 1, archive: false, origine: "utilisateur" },
  });

  const d2 = creerDomaineFactice({
    id: "architecture",
    nom: "Architectures logicielles",
    description: "Monolithe et microservices",
    nombreEvaluees: 2,
    derniereActivite: "2026-08-14T10:00:00.000Z",
    domaine: { id: "architecture", nom: "Architectures logicielles", prefixe: "ARC", description: "", ordre: 2, version: 1, archive: false, origine: "utilisateur" },
  });

  const d3 = creerDomaineFactice({
    id: "logique",
    nom: "Logique stoïcienne",
    description: "Raisonnement et dialectique",
    nombreEvaluees: 1,
    derniereActivite: "2026-08-12T08:00:00.000Z",
    domaine: { id: "logique", nom: "Logique stoïcienne", prefixe: "LOG", description: "", ordre: 3, version: 1, archive: false, origine: "utilisateur" },
  });

  const liste = [d1, d2, d3];

  it("calcule correctement le ratio de couverture", () => {
    expect(calculerRatioCouverture(d1)).toBe(0);
    expect(calculerRatioCouverture(d2)).toBe(1); // 2/2 = 100%
    expect(calculerRatioCouverture(d3)).toBe(0.5); // 1/2 = 50%
  });

  it("trie par activité récente (défaut)", () => {
    const res = filtrerEtTrierDomaines(liste, { tri: "recent" });
    expect(res.map((d) => d.id)).toEqual(["architecture", "logique", "stoicisme"]);
  });

  it("trie par taux de couverture décroissant", () => {
    const res = filtrerEtTrierDomaines(liste, { tri: "couverture-desc" });
    expect(res.map((d) => d.id)).toEqual(["architecture", "logique", "stoicisme"]);
  });

  it("trie par taux de couverture croissant", () => {
    const res = filtrerEtTrierDomaines(liste, { tri: "couverture-asc" });
    expect(res.map((d) => d.id)).toEqual(["stoicisme", "logique", "architecture"]);
  });

  it("trie par ordre alphabétique croissant", () => {
    const res = filtrerEtTrierDomaines(liste, { tri: "alpha-asc" });
    expect(res.map((d) => d.id)).toEqual(["architecture", "stoicisme", "logique"]);
  });

  it("trie par ordre alphabétique décroissant", () => {
    const res = filtrerEtTrierDomaines(liste, { tri: "alpha-desc" });
    expect(res.map((d) => d.id)).toEqual(["logique", "stoicisme", "architecture"]);
  });

  it("trie par ordre du référentiel", () => {
    const res = filtrerEtTrierDomaines(liste, { tri: "ordre" });
    expect(res.map((d) => d.id)).toEqual(["stoicisme", "architecture", "logique"]);
  });

  it("filtre par terme de recherche", () => {
    const res = filtrerEtTrierDomaines(liste, { recherche: "microservices" });
    expect(res.map((d) => d.id)).toEqual(["architecture"]);
  });

  it("filtre par statut en cours", () => {
    const res = filtrerEtTrierDomaines(liste, { statut: "en-cours" });
    expect(res.map((d) => d.id)).toEqual(["logique"]);
  });

  it("filtre par statut non démarré", () => {
    const res = filtrerEtTrierDomaines(liste, { statut: "non-demarre" });
    expect(res.map((d) => d.id)).toEqual(["stoicisme"]);
  });

  it("filtre par statut complété", () => {
    const res = filtrerEtTrierDomaines(liste, { statut: "complete" });
    expect(res.map((d) => d.id)).toEqual(["architecture"]);
  });
});
