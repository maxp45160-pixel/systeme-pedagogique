import { describe, expect, it } from "vitest";
import { proposerClassementDepuisDomaineCreation } from "./classement-atelier";

describe("proposition de classement dans Mes cours", () => {
  it("propose le domaine de création sans écrire de tag", () => {
    expect(
      proposerClassementDepuisDomaineCreation(
        { domaine: "maths" },
        [{ id: "maths", nom: "Mathématiques", archive: false }],
      ),
    ).toEqual({
      domaineId: "maths",
      domaineNom: "Mathématiques",
      justification: "Ce domaine a créé cette compétence ; vérifiez qu’elle y sert toujours.",
    });
  });

  it("reste silencieuse pour un domaine archivé", () => {
    expect(
      proposerClassementDepuisDomaineCreation(
        { domaine: "maths" },
        [{ id: "maths", nom: "Mathématiques", archive: true }],
      ),
    ).toBeNull();
  });
});
