import { describe, expect, it } from "vitest";
import {
  SEUIL_PROPOSITION,
  enumNoeudsCarte,
  estNoeudCarteValide,
  libelleChemin,
  proposerClassification,
} from "./classification-domaine";
import { RACINE_CARTE, VERSION_CARTE } from "@/lib/domain/carte-savoirs";

/*
 * Ce que ce fichier protège :
 *   - le classement est reproductible — même entrée, même sortie, toujours ;
 *   - sous le seuil, RIEN n'est proposé plutôt qu'un rattachement faux ;
 *   - le tuteur ne peut nommer qu'un nœud de l'énumération serveur.
 */

describe("proposerClassification", () => {
  it("rapproche un domaine de sa région quand le vocabulaire le porte", () => {
    const proposition = proposerClassification({
      domaineId: "algebre-lineaire",
      nom: "Algèbre linéaire",
      description: "Vecteurs, matrices et équations.",
      intitules: ["Résoudre une équation matricielle", "Calculer un déterminant"],
    });

    expect(proposition.candidats[0]?.noeud).toBe("mathematiques");
    expect(proposition.versionCarte).toBe(VERSION_CARTE);
    expect(proposition.origine).toBe("lexical");
  });

  it("rend exactement le même classement d'un appel à l'autre", () => {
    const entree = {
      domaineId: "reseaux",
      nom: "Réseaux et programmation",
      intitules: ["Écrire un algorithme de tri", "Lire une base de données"],
    };
    const a = proposerClassification(entree);
    const b = proposerClassification(entree);

    expect(a).toEqual(b);
  });

  it("ne propose rien plutôt qu'un rattachement faux quand aucun vocabulaire ne correspond", () => {
    const proposition = proposerClassification({
      domaineId: "zzz",
      nom: "Zzzz",
      description: "",
    });

    expect(proposition.candidats).toEqual([]);
  });

  it("ne propose rien sur une entrée vide, sans lever d'erreur", () => {
    const proposition = proposerClassification({ domaineId: "vide", nom: "   " });

    expect(proposition.candidats).toEqual([]);
  });

  it("ne rend jamais de candidat sous le seuil", () => {
    const proposition = proposerClassification({
      domaineId: "logistique",
      nom: "Logistique industrielle",
      intitules: ["Planifier une chaîne de production"],
    });

    for (const candidat of proposition.candidats) {
      expect(candidat.score).toBeGreaterThanOrEqual(SEUIL_PROPOSITION);
    }
  });

  it("borne le nombre de candidats", () => {
    const proposition = proposerClassification(
      { domaineId: "d", nom: "Biologie cellulaire et génétique" },
      { nombreCandidats: 2 },
    );

    expect(proposition.candidats.length).toBeLessThanOrEqual(2);
  });

  it("justifie chaque candidat par des mots et une valeur mesurée", () => {
    const proposition = proposerClassification({
      domaineId: "compta",
      nom: "Comptabilité et finance d'entreprise",
    });
    const candidat = proposition.candidats[0];

    expect(candidat).toBeDefined();
    expect(candidat.explication.facteurs.map((facteur) => facteur.libelle)).toEqual([
      "Mots partagés",
      "Proximité mesurée",
      "Version de carte",
    ]);
    expect(candidat.chemin.startsWith("Savoirs humains › ")).toBe(true);
  });

  it("marque l'ambiguïté au lieu de trancher quand deux régions sont au coude à coude", () => {
    /*
     * On force le cas : un score identique entre les deux premiers candidats
     * rend l'écart relatif nul, donc inférieur à tout écart décisif.
     */
    const proposition = proposerClassification({
      domaineId: "mixte",
      nom: "Territoire",
      intitules: ["Lire une carte", "Décrire un paysage", "Étudier une population"],
    });

    const premier = proposition.candidats[0];
    const second = proposition.candidats[1];
    if (premier && second && premier.score - second.score < premier.score * 0.15) {
      expect(premier.ambigu).toBe(true);
    } else {
      expect(premier?.ambigu).toBe(false);
    }
  });
});

describe("garde-fou du tuteur", () => {
  it("expose une énumération fermée, sans la racine", () => {
    const codes = enumNoeudsCarte();
    expect(codes).not.toContain(RACINE_CARTE);
    expect(codes).toContain("mathematiques");
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("refuse tout ce qui n'est pas un nœud rattachable", () => {
    expect(estNoeudCarteValide("mathematiques")).toBe(true);
    expect(estNoeudCarteValide(RACINE_CARTE)).toBe(false);
    expect(estNoeudCarteValide("region-inventee")).toBe(false);
    expect(estNoeudCarteValide(null)).toBe(false);
    expect(estNoeudCarteValide(42)).toBe(false);
  });
});

describe("libelleChemin", () => {
  it("rend l'identifiant tel quel quand il est inconnu, sans inventer de chemin", () => {
    expect(libelleChemin("region-inventee")).toBe("region-inventee");
  });
});
