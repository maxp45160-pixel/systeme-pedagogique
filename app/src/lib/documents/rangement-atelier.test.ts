import { describe, expect, it } from "vitest";

import {
  estATrier,
  rangementDomaine,
  rangementTheme,
  rangerDocument,
} from "./rangement-atelier";

describe("rangement de l'Atelier", () => {
  it("sort les preuves du corpus consultable", () => {
    const rangement = rangerDocument({
      estPreuve: true,
      domaineConnu: "dev",
      competencesCitees: ["DEV-01"],
    });
    expect(rangement.zone).toBe("hors-corpus");
  });

  /*
   * Une fiche produite par le système pour un domaine connu — la fiche d'un
   * exercice mené, typiquement — se cherche dans ce domaine. Une note capturée
   * par la personne déclare un rôle : elle reste une ressource, même si son
   * front-matter mentionne un domaine.
   */
  it("range une production du système dans son domaine, une note capturée dans les ressources", () => {
    expect(
      rangerDocument({ estPreuve: false, domaineConnu: "dev", competencesCitees: [] }),
    ).toEqual({ zone: "domaine", domaineId: "dev", rattachements: [] });

    expect(
      rangerDocument({
        estPreuve: false,
        domaineConnu: "dev",
        role: "support",
        competencesCitees: ["DEV-01"],
      }),
    ).toEqual({ zone: "ressource", rattachements: ["DEV-01"] });
  });

  it("déclare à trier une ressource qui ne sert encore aucune compétence", () => {
    const orpheline = rangerDocument({ estPreuve: false, competencesCitees: [] });
    expect(estATrier(orpheline)).toBe(true);

    const rattachee = rangerDocument({ estPreuve: false, competencesCitees: ["RO-01"] });
    expect(estATrier(rattachee)).toBe(false);
  });

  /*
   * Le doublon était la plaie de l'ancien arbre : une compétence était déposée
   * dans son domaine **et** dans `Transversal/Compétences`. Un rangement rend
   * une seule zone, et les rattachements sont dédupliqués.
   */
  it("ne rend qu'une zone par élément et ne double aucun rattachement", () => {
    const rangement = rangerDocument({
      estPreuve: false,
      competencesCitees: ["RO-01", "DEV-02", "RO-01"],
    });
    expect(rangement.zone).toBe("ressource");
    expect(rangement.rattachements).toEqual(["DEV-02", "RO-01"]);

    expect(rangementDomaine("logistique").zone).toBe("domaine");
    expect(rangementTheme().zone).toBe("theme");
    expect(rangementTheme().rattachements).toEqual([]);
  });
});
