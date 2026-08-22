import { describe, expect, it } from "vitest";

import { OUTIL_TAGS, outilsTagsCompetence, validerAppelOutil } from "./outils";
import { construirePromptTagsCompetence } from "./tags-competence";

/**
 * Ce que fige ce fichier : le tuteur PROPOSE des tags, il n'en pose aucun, et
 * il ne peut nommer que des domaines qui existent déjà (ADR-107, ADR-043).
 */

const DOMAINES = [
  { id: "statistiques", nom: "Statistiques", chemin: "Sciences › Statistiques", description: "" },
  { id: "logistique", nom: "Logistique", chemin: "Logistique", description: "Flux et stocks" },
];

describe("l'outil de proposition de tags", () => {
  it("ferme l'énumération sur les domaines fournis par le serveur", () => {
    const outil = outilsTagsCompetence(DOMAINES.map((d) => d.id));
    expect(outil.schema.properties?.tags?.items?.properties?.domaineId?.enum).toEqual([
      "statistiques",
      "logistique",
    ]);
  });

  it("n'expose aucun champ qui créerait un domaine", () => {
    const outil = outilsTagsCompetence(["statistiques"]);
    const champs = Object.keys(outil.schema.properties?.tags?.items?.properties ?? {});
    expect(champs.sort()).toEqual(["domaineId", "justification"]);
  });

  it("accepte une proposition dont les domaines sont connus", () => {
    const outils = [outilsTagsCompetence(["statistiques", "logistique"])];
    const recu = validerAppelOutil(
      OUTIL_TAGS,
      {
        tags: [
          { domaineId: "logistique", justification: "Elle sert à lire un tableau de stocks." },
        ],
      },
      outils,
    );

    expect(recu).toEqual({
      genre: "tags",
      tags: { tags: [{ domaineId: "logistique", justification: "Elle sert à lire un tableau de stocks." }] },
    });
  });

  /*
   * Deuxième couche après l'`enum` (ADR-031) : un fournisseur qui ignore
   * l'énumération ne doit pas passer pour autant. Ici la ligne fautive est
   * écartée, pas l'appel entier — chaque tag s'arbitre séparément.
   */
  it("écarte un domaine absent du schéma armé, et garde le reste", () => {
    const outils = [outilsTagsCompetence(["statistiques"])];
    const recu = validerAppelOutil(
      OUTIL_TAGS,
      {
        tags: [
          { domaineId: "domaine-invente", justification: "…" },
          { domaineId: "statistiques", justification: "Elle y sert." },
        ],
      },
      outils,
    );

    expect(recu).toEqual({
      genre: "tags",
      tags: { tags: [{ domaineId: "statistiques", justification: "Elle y sert." }] },
    });
  });

  it("déduplique deux fois le même domaine", () => {
    const outils = [outilsTagsCompetence(["statistiques"])];
    const recu = validerAppelOutil(
      OUTIL_TAGS,
      {
        tags: [
          { domaineId: "statistiques", justification: "Premier motif." },
          { domaineId: "statistiques", justification: "Second motif." },
        ],
      },
      outils,
    );

    expect(recu).toMatchObject({ genre: "tags", tags: { tags: [{ justification: "Premier motif." }] } });
  });

  it("refuse un tag sans justification : une proposition sans motif ne s'arbitre pas", () => {
    const outils = [outilsTagsCompetence(["statistiques"])];
    const recu = validerAppelOutil(
      OUTIL_TAGS,
      { tags: [{ domaineId: "statistiques" }] },
      outils,
    );

    expect(recu).toEqual({ genre: "tags", tags: { tags: [] } });
  });

  it("accepte une liste vide — « aucun domaine ne convient » est une réponse", () => {
    const outils = [outilsTagsCompetence(["statistiques"])];
    expect(validerAppelOutil(OUTIL_TAGS, { tags: [] }, outils)).toEqual({
      genre: "tags",
      tags: { tags: [] },
    });
  });

  it("rejette un appel sans liste du tout", () => {
    expect(validerAppelOutil(OUTIL_TAGS, { resume: "je ne sais pas" }, [])).toBeNull();
  });
});

describe("le prompt de proposition de tags", () => {
  const prompt = construirePromptTagsCompetence({
    code: "STA-01",
    intitule: "Lire un tableau de données",
    palier: "fondamentaux",
    domaines: DOMAINES,
  });

  it("dit au tuteur qu'il n'applique rien", () => {
    expect(prompt).toContain("TU N'APPLIQUES RIEN.");
  });

  it("liste les domaines proposables avec leur chemin", () => {
    expect(prompt).toContain("statistiques — Sciences › Statistiques");
    expect(prompt).toContain("logistique — Logistique : Flux et stocks");
  });

  it("interdit d'inventer un identifiant", () => {
    expect(prompt).toContain("N'invente aucun identifiant.");
  });
});
