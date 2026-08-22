import { describe, expect, it } from "vitest";
import {
  NOEUDS_CARTE,
  RACINE_CARTE,
  RELATIONS_CARTE,
  cheminCarte,
  enfantsCarte,
  noeudCarte,
  noeudsRattachables,
  regionsCarte,
} from "./carte-savoirs";

/*
 * Ce que ce fichier protège : la carte est une donnée de dépôt, elle n'est
 * donc pas plus à l'abri d'une faute de frappe qu'une donnée de base. Un
 * identifiant dupliqué, un parent inexistant ou un cycle rendraient toute
 * classification incohérente sans rien casser visiblement.
 */

describe("carte des savoirs", () => {
  it("n'a aucun identifiant dupliqué", () => {
    const ids = NOEUDS_CARTE.map((noeud) => noeud.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("n'a qu'une racine, et tout parent déclaré existe", () => {
    const ids = new Set(NOEUDS_CARTE.map((noeud) => noeud.id));
    const racines = NOEUDS_CARTE.filter((noeud) => noeud.parent === null);
    expect(racines.map((noeud) => noeud.id)).toEqual([RACINE_CARTE]);
    for (const noeud of NOEUDS_CARTE) {
      if (noeud.parent !== null) expect(ids.has(noeud.parent)).toBe(true);
    }
  });

  it("ne contient aucun cycle : tout nœud remonte à la racine", () => {
    for (const noeud of NOEUDS_CARTE) {
      const chemin = cheminCarte(noeud.id);
      expect(chemin[0]?.id).toBe(RACINE_CARTE);
      expect(chemin[chemin.length - 1]?.id).toBe(noeud.id);
    }
  });

  it("expose les quatre régions de la source", () => {
    expect(regionsCarte().map((noeud) => noeud.id)).toEqual([
      "creations-humaines",
      "monde-physique",
      "monde-vivant",
      "etre-humain",
    ]);
  });

  it("ne rend jamais la racine comme cible de rattachement", () => {
    expect(noeudsRattachables().some((noeud) => noeud.id === RACINE_CARTE)).toBe(false);
    expect(noeudsRattachables()).toHaveLength(NOEUDS_CARTE.length - 1);
  });

  it("donne un chemin lisible de la racine au nœud", () => {
    expect(cheminCarte("mathematiques").map((noeud) => noeud.nom)).toEqual([
      "Savoirs humains",
      "Créations humaines",
      "Mathématiques",
    ]);
  });

  it("rend un chemin vide pour un identifiant inconnu, sans jamais inventer de nœud", () => {
    expect(cheminCarte("region-inexistante")).toEqual([]);
    expect(noeudCarte("region-inexistante")).toBeUndefined();
  });

  it("rattache chaque discipline à une région, jamais directement à la racine", () => {
    const regions = new Set(regionsCarte().map((noeud) => noeud.id));
    for (const region of regions) {
      expect(enfantsCarte(region).length).toBeGreaterThan(0);
    }
    const orphelins = NOEUDS_CARTE.filter(
      (noeud) => noeud.parent === RACINE_CARTE && !regions.has(noeud.id),
    );
    expect(orphelins).toEqual([]);
  });

  it("n'accepte aucune relation vers un nœud absent, ni sans motif", () => {
    const ids = new Set(NOEUDS_CARTE.map((noeud) => noeud.id));
    for (const relation of RELATIONS_CARTE) {
      expect(ids.has(relation.source)).toBe(true);
      expect(ids.has(relation.cible)).toBe(true);
      expect(relation.motif.trim().length).toBeGreaterThan(0);
      expect(relation.source).not.toBe(relation.cible);
    }
  });

  it("ne porte aucune donnée personnelle : les nœuds n'ont que nom, parent et vocabulaire", () => {
    const clesAutorisees = new Set(["id", "nom", "parent", "motsCles"]);
    for (const noeud of NOEUDS_CARTE) {
      for (const cle of Object.keys(noeud)) {
        expect(clesAutorisees.has(cle)).toBe(true);
      }
    }
  });
});
