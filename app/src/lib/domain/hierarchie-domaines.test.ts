import { describe, expect, it } from "vitest";

import {
  ancetres,
  chemin,
  domainesVisibles,
  indexerEnfants,
  parcourirHierarchie,
  parenteCirculaire,
  parentsPossibles,
  profondeur,
  racines,
  sousArbre,
} from "./hierarchie-domaines";
import type { Domaine } from "./types";

const domaine = (id: string, parentId?: string): Domaine => ({
  id,
  nom: id,
  prefixe: id.slice(0, 3).toUpperCase(),
  description: "",
  ordre: 0,
  version: 1,
  archive: false,
  origine: "utilisateur",
  ...(parentId ? { parentId } : {}),
});

/** Sciences › Physique › Thermodynamique, plus une racine à part. */
const ARBRE: Domaine[] = [
  domaine("sciences"),
  domaine("physique", "sciences"),
  domaine("thermodynamique", "physique"),
  domaine("chimie", "sciences"),
  domaine("logistique"),
];

describe("la hiérarchie des domaines", () => {
  it("range les domaines sans parent connu à la racine", () => {
    expect(racines(ARBRE).map((d) => d.id)).toEqual(["sciences", "logistique"]);
  });

  it("remonte la lignée d'un domaine, du parent vers la racine", () => {
    expect(ancetres(ARBRE, "thermodynamique")).toEqual(["physique", "sciences"]);
    expect(ancetres(ARBRE, "sciences")).toEqual([]);
    expect(profondeur(ARBRE, "thermodynamique")).toBe(2);
  });

  it("rend le chemin complet, racine incluse", () => {
    expect(chemin(ARBRE, "thermodynamique").map((d) => d.id)).toEqual([
      "sciences",
      "physique",
      "thermodynamique",
    ]);
    expect(chemin(ARBRE, "inconnu")).toEqual([]);
  });

  it("rend le sous-arbre, domaine compris", () => {
    expect([...sousArbre(ARBRE, "sciences")].sort()).toEqual([
      "chimie",
      "physique",
      "sciences",
      "thermodynamique",
    ]);
    expect([...sousArbre(ARBRE, "thermodynamique")]).toEqual(["thermodynamique"]);
  });

  /*
   * Un identifiant inconnu ne rend pas un ensemble vide : une compétence
   * réellement taguée dessus disparaîtrait de l'écran. Il rend le singleton.
   */
  it("rend un sous-arbre réduit à lui-même pour un domaine inconnu", () => {
    expect([...sousArbre(ARBRE, "disparu")]).toEqual(["disparu"]);
  });

  it("dérive la visibilité héritée sans rien écrire", () => {
    expect([...domainesVisibles(ARBRE, ["thermodynamique"])].sort()).toEqual([
      "physique",
      "sciences",
      "thermodynamique",
    ]);
    // Deux tags dans la même lignée ne produisent pas de doublon.
    expect([...domainesVisibles(ARBRE, ["thermodynamique", "physique"])].sort()).toEqual([
      "physique",
      "sciences",
      "thermodynamique",
    ]);
    expect([...domainesVisibles(ARBRE, [])]).toEqual([]);
  });

  it("refuse une parenté qui fermerait une boucle", () => {
    expect(parenteCirculaire(ARBRE, "sciences", "thermodynamique")).toBe(true);
    expect(parenteCirculaire(ARBRE, "sciences", "sciences")).toBe(true);
    expect(parenteCirculaire(ARBRE, "logistique", "thermodynamique")).toBe(false);
    // Remettre à la racine ne peut jamais boucler.
    expect(parenteCirculaire(ARBRE, "thermodynamique", null)).toBe(false);
  });

  it("ne propose comme destinations que ce qui ne descend pas du domaine", () => {
    expect(parentsPossibles(ARBRE, "physique").map((d) => d.id)).toEqual([
      "sciences",
      "chimie",
      "logistique",
    ]);
  });

  it("parcourt l'arbre parents avant enfants, avec la profondeur", () => {
    expect(parcourirHierarchie(ARBRE).map((e) => [e.domaine.id, e.profondeur])).toEqual([
      ["sciences", 0],
      ["physique", 1],
      ["thermodynamique", 2],
      ["chimie", 1],
      ["logistique", 0],
    ]);
  });
});

/**
 * `deplacer_domaine` refuse les cycles et la contrainte
 * `domaines_parent_pas_soi` refuse l'auto-parenté : ces cas ne devraient pas
 * exister en base. Les lectures restent néanmoins totales — une hiérarchie
 * corrompue doit rendre une lecture partielle, jamais bloquer un rendu.
 */
describe("une hiérarchie corrompue se lit quand même", () => {
  const CYCLE: Domaine[] = [
    domaine("a", "b"),
    domaine("b", "a"),
    domaine("racine"),
  ];

  it("ne boucle pas en remontant un cycle", () => {
    expect(ancetres(CYCLE, "a")).toEqual(["b"]);
    expect([...sousArbre(CYCLE, "a")].sort()).toEqual(["a", "b"]);
  });

  it("montre quand même les domaines pris dans un cycle", () => {
    const parcours = parcourirHierarchie(CYCLE).map((e) => e.domaine.id);
    expect(parcours).toContain("a");
    expect(parcours).toContain("b");
    expect(parcours).toContain("racine");
  });

  it("traite un parent disparu comme une racine", () => {
    const orphelin = [domaine("enfant", "parent-supprime")];
    expect(racines(orphelin).map((d) => d.id)).toEqual(["enfant"]);
    expect(ancetres(orphelin, "enfant")).toEqual([]);
    expect(indexerEnfants(orphelin).get(null)?.map((d) => d.id)).toEqual(["enfant"]);
  });
});
